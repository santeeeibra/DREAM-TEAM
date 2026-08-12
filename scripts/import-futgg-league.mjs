/**
 * Importa jugadores de una liga desde FUT.GG a la tabla `cards` de Supabase.
 *
 *   node scripts/import-futgg-league.mjs laliga
 *   node scripts/import-futgg-league.mjs seriea --dry-run
 *
 * Trae las cartas base (no promos/iconos/heroes/evoluciones) de FC26 con
 * overall >= MIN_OVERALL, sube fotos/escudos/logos a Storage y hace upsert
 * sobre el indice parcial cards_league_fut_id_unique (league_id, fut_id).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- config ---------------------------------------------------------------

const LEAGUES = {
  premier:     { eaId: 13, label: 'Premier League' },
  laliga:      { eaId: 53, label: 'LaLiga' },
  seriea:      { eaId: 31, label: 'Serie A' },
  bundesliga:  { eaId: 19, label: 'Bundesliga' },
  ligapro:     { eaId: 353, label: 'Liga Profesional Argentina' },
  mls:         { eaId: 39, label: 'MLS' },
  ligue1:      { eaId: 16, label: 'Ligue 1' },
};

const GAME = 26;
const MIN_OVERALL = 74; // override por liga con minOverall en LEAGUES
const PAGE_DELAY_MS = 80;
const CONCURRENCY = 8; // uploads en paralelo
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

const BUCKET_PHOTOS = 'player-photos';
const BUCKET_BADGES = 'team-badges';

// --- env ------------------------------------------------------------------

function loadEnv() {
  const txt = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en .env');

// --- mapeos ---------------------------------------------------------------

const POSITION_MAP = {
  GK: 'POR',
  CB: 'DEF', LB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF',
  CDM: 'MED', CM: 'MED', CAM: 'MED', LM: 'MED', RM: 'MED',
  LW: 'DEL', RW: 'DEL', ST: 'DEL', CF: 'DEL',
};

function toRarity(overall) {
  if (overall >= 85) return 'epica';
  if (overall >= 80) return 'oro_unico';
  if (overall >= 74) return 'oro_comun';
  return 'bronce';
}

function playerName(p) {
  return p.commonName || [p.firstName, p.lastName].filter(Boolean).join(' ') || p.cardName;
}

// --- FUT.GG ---------------------------------------------------------------

async function futggFetch(url, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json', Referer: 'https://www.fut.gg/players/' },
      });
      if (r.ok) return r;
      lastErr = new Error(`HTTP ${r.status} en ${url}`);
    } catch (e) {
      lastErr = e;
    }
    await sleep(500 * 2 ** i);
  }
  throw lastErr;
}

async function fetchLeaguePlayers(leagueEaId) {
  const items = [];
  for (let page = 1; ; page++) {
    const r = await futggFetch(`https://www.fut.gg/api/fut/players/v2/${GAME}/?league_id=${leagueEaId}&page=${page}`);
    const j = await r.json();
    items.push(...j.data);
    if (process.stdout.isTTY) process.stdout.write(`\r  fut.gg pagina ${page}/${Math.ceil(j.total / 30)} (${items.length} items)   `);
    if (!j.next) break;
    await sleep(PAGE_DELAY_MS);
  }
  console.log();
  return items;
}

/** Cartas base unicas, la de mayor overall por jugador. */
function selectBaseCards(items, minOvr = MIN_OVERALL) {
  const byEaId = new Map();
  for (const p of items) {
    if (p.isSpecial || p.isEvolutionPlayerItem || p.isIcon || p.isHero) continue;
    if (p.overall < minOvr) continue;
    // El id estable del JUGADOR (base) es basePlayerEaId; p.eaId es el id del
    // item/versión (incluso el contenido de la foto cambia), y la BD guarda
    // futble clásicos. Deduplicar por basePlayerEaId.
    const id = p.basePlayerEaId ?? p.eaId;
    const prev = byEaId.get(id);
    if (!prev || p.overall > prev.overall) byEaId.set(id, p);
  }
  return [...byEaId.values()].sort((a, b) => b.overall - a.overall);
}

// --- Supabase Storage -----------------------------------------------------

const publicUrl = (bucket, key) => `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${key}`;

async function uploadAsset(bucket, key, sourceUrl, opts = {}) {
  // Con force=false cachea: si la key ya existe (ej. una foto vieja mala),
  // no re-descarga. Con force=true (fotos de jugador) re-descarga y
  // sobrescribe con x-upsert:true, para corregir fotos ya subidas mal.
  if (!opts.force) {
    const head = await fetch(publicUrl(bucket, key), { method: 'HEAD' });
    if (head.ok) return publicUrl(bucket, key);
  }

  const src = await futggFetch(sourceUrl);
  const body = Buffer.from(await src.arrayBuffer());
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': opts.contentType || src.headers.get('content-type') || 'image/webp',
      'x-upsert': 'true',
    },
    body,
  });
  if (!r.ok) throw new Error(`upload ${bucket}/${key}: ${r.status} ${await r.text()}`);
  return publicUrl(bucket, key);
}

// --- Postgres via PostgREST ----------------------------------------------

// PostgREST no puede inferir un indice UNIQUE parcial en ON CONFLICT (42P10), asi que
// el upsert vive en la funcion upsert_cards_from_futgg(jsonb), que si lleva el WHERE.
async function upsertCards(rows) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_cards_from_futgg`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ payload: rows }),
  });
  if (!r.ok) throw new Error(`upsert: ${r.status} ${await r.text()}`);
  return Number(await r.text());
}

// --- main -----------------------------------------------------------------

const sleep = ms => new Promise(s => setTimeout(s, ms));

async function main() {
  const key = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  const league = LEAGUES[key];
  if (!league) {
    console.error(`Uso: node scripts/import-futgg-league.mjs <${Object.keys(LEAGUES).join('|')}> [--dry-run]`);
    process.exit(1);
  }

  console.log(`\n=== ${league.label} (EA ${league.eaId}) -> league_id='${key}'${dryRun ? '  [DRY RUN]' : ''} ===`);

  const minOvr = league.minOverall ?? MIN_OVERALL;
  const items = await fetchLeaguePlayers(league.eaId);
  const players = selectBaseCards(items, minOvr);
  console.log(`  ${items.length} items -> ${players.length} cartas base con overall >= ${minOvr}`);

  if (players.length === 0) {
    console.error(`  ERROR: 0 jugadores encontrados. Verificá el eaId (${league.eaId}) o bajá minOverall.`);
    process.exit(1);
  }

  // logo de liga: una sola vez
  const leagueSample = players.find(p => p.leagueImageUrl);
  const leagueLogoUrl = dryRun || !leagueSample
    ? null
    : await uploadAsset(BUCKET_BADGES, `league/${league.eaId}.webp`, leagueSample.leagueImageUrl);

  // escudos de club: todos en paralelo (pocos clubs, sin riesgo de rate-limit)
  const clubs = new Map();
  for (const p of players) if (p.club?.eaId && !clubs.has(p.club.eaId)) clubs.set(p.club.eaId, p.clubImageUrl);
  const clubBadge = new Map();
  if (!dryRun) {
    await Promise.all([...clubs.entries()].map(async ([clubEaId, srcUrl]) => {
      clubBadge.set(clubEaId, await uploadAsset(BUCKET_BADGES, `club/${clubEaId}.webp`, srcUrl));
    }));
  }
  console.log(`  ${clubs.size} escudos de club listos`);

  // fotos de jugador: en paralelo de a CONCURRENCY
  // force:false → si la foto ya existe en Storage la saltea (re-runs rápidos).
  // Para forzar re-descarga de una foto específica, borrala de Storage primero.
  // Banderas de nación: subidas solo una vez por nationId (cache en Storage).
  const nationFlagCache = new Map();
  async function getNationFlagUrl(nationId, nationImageUrl) {
    if (!nationId) return null;
    if (nationFlagCache.has(nationId)) return nationFlagCache.get(nationId);
    let url = null;
    if (!dryRun && nationImageUrl) {
      try {
        const src = nationImageUrl.replace('format=auto', 'format=webp');
        url = await uploadAsset(BUCKET_BADGES, `nation/${nationId}.webp`, src, { contentType: 'image/webp' });
      } catch (e) {
        console.warn(`\n    bandera nación ${nationId}: ${e.message}`);
      }
    }
    nationFlagCache.set(nationId, url);
    return url;
  }

  async function uploadRow(p) {
    const futId = String(p.basePlayerEaId ?? p.eaId);
    const futbinUrl = `https://cdn.futbin.com/content/fifa${GAME}/img/players/${futId}.png`;
    const futggUrl = p.imageUrl.replace('format=auto', 'format=webp');
    let photoUrl = null, source = 'FUTBIN', sourceUrl = futbinUrl;
    if (!dryRun) {
      try {
        photoUrl = await uploadAsset(BUCKET_PHOTOS, `futbin/${futId}.png`, futbinUrl, { contentType: 'image/png' });
      } catch (e) {
        console.warn(`\n    fallback fut.gg para ${playerName(p)} (${futId}): ${e.message}`);
        source = 'FUT.GG'; sourceUrl = `https://www.fut.gg${p.url}`;
        photoUrl = await uploadAsset(BUCKET_PHOTOS, `futgg/${futId}.webp`, futggUrl, { contentType: 'image/webp' });
      }
    }
    // Nacionalidad: el campo puede venir como p.nationId, p.nation?.eaId, o p.nation?.id
    const nationId = p.nationId ?? p.nation?.eaId ?? p.nation?.id ?? null;
    const nationImageUrl = p.nationImageUrl ?? p.nation?.imageUrl ?? null;
    const nationFlagUrl = nationId ? await getNationFlagUrl(nationId, nationImageUrl) : null;

    return {
      fut_id: futId, name: playerName(p), club: p.club?.name ?? null,
      position: POSITION_MAP[p.position] ?? 'MED', overall_rating: p.overall,
      rarity: toRarity(p.overall), league_id: key, photo_url: photoUrl,
      club_badge_url: clubBadge.get(p.club?.eaId) ?? null, league_logo_url: leagueLogoUrl,
      nation_flag_url: nationFlagUrl, nationality_id: nationId ? Number(nationId) : null,
      is_active: true, uses_generated_avatar: false, photo_source_url: sourceUrl, photo_credit: source,
    };
  }

  const rows = [];
  let done = 0;
  for (let b = 0; b < players.length; b += CONCURRENCY) {
    const batch = await Promise.all(players.slice(b, b + CONCURRENCY).map(uploadRow));
    rows.push(...batch);
    done += batch.length;
    if (process.stdout.isTTY) process.stdout.write(`\r  fotos ${done}/${players.length}   `);
  }
  console.log();

  const unmapped = players.filter(p => !POSITION_MAP[p.position]);
  if (unmapped.length) console.warn(`  AVISO: ${unmapped.length} posiciones sin mapear -> MED:`, [...new Set(unmapped.map(p => p.position))]);

  if (dryRun) {
    fs.writeFileSync(path.join(ROOT, `scripts/tmp-${key}-preview.json`), JSON.stringify(rows, null, 2));
    console.log(`  DRY RUN: ${rows.length} filas escritas a scripts/tmp-${key}-preview.json (sin tocar la BD)`);
    return;
  }

  for (let b = 0; b < rows.length; b += 100) {
    await upsertCards(rows.slice(b, b + 100));
    if (process.stdout.isTTY) process.stdout.write(`\r  upsert ${Math.min(b + 100, rows.length)}/${rows.length}   `);
  }
  console.log(`\n  OK: ${rows.length} cartas en league_id='${key}'\n`);
}

await main();
