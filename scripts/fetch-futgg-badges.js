// scripts/fetch-futgg-badges.js
//
// Resuelve escudo de club, bandera de país y logo de liga (estilo carta
// EA FC Ultimate Team) para las cartas que ya tienen fut_id asignado
// (ver scripts/fetch-futgg-images.js, que es quien resuelve fut_id).
// Fuente: fut.gg/api/fut/player-item-definitions/26/{fut_id}/, el mismo
// dominio que ya usa fetch-futgg-images.js para la foto. La respuesta
// trae club/nation/league anidados, cada uno con un eaId estable y un
// imageUrl en el CDN de fut.gg (game-assets.fut.gg).
//
// A diferencia de fetch-futgg-images.js (que busca por nombre y
// desambigua por posición), acá no hay ambigüedad: se pide el detalle
// directo por fut_id.
//
// Dedup: club/nation/league se repiten en decenas de cartas (todos los
// jugadores de un mismo club, país o liga comparten el mismo eaId), así
// que se cachea en memoria durante la corrida y solo se descarga/sube
// un archivo por eaId, no uno por carta.
//
// Nunca corta el script entero por un jugador: si falla cualquier paso
// (fut_id sin match, imagen caída, error de Storage/DB), loguea el
// motivo y sigue con el siguiente sin tocar su fila.
//
// Uso:
//   node scripts/fetch-futgg-badges.js               # todas las pendientes
//   node scripts/fetch-futgg-badges.js --limit 10    # solo 10 (prueba)

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "❌ ERROR: faltan SUPABASE_URL y/o SUPABASE_SERVICE_KEY en el archivo .env"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const BUCKET = "team-badges";
const WEBP_QUALITY = 90;
const RATE_LIMIT_MS = 300;
const FUT_GG_DETAIL_URL = "https://www.fut.gg/api/fut/player-item-definitions/26";

// --limit N: procesa solo las primeras N cartas pendientes (para pruebas).
const LIMIT = (() => {
  const idx = process.argv.indexOf("--limit");
  if (idx === -1) return null;
  const value = Number(process.argv[idx + 1]);
  return Number.isFinite(value) && value > 0 ? value : null;
})();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureBucketExists() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`No se pudo listar buckets de Storage: ${listError.message}`);
  }

  if (buckets.some((bucket) => bucket.name === BUCKET)) return;

  console.log(`🪣 Bucket "${BUCKET}" no existe, creándolo como público...`);
  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
  });

  if (createError) {
    throw new Error(`No se pudo crear el bucket "${BUCKET}": ${createError.message}`);
  }
}

async function fetchPendingCards(limit) {
  let query = supabase
    .from("cards")
    .select("id, name, fut_id, club_badge_url, nation_flag_url, league_logo_url")
    .not("fut_id", "is", null)
    .or("club_badge_url.is.null,nation_flag_url.is.null,league_logo_url.is.null");

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Error leyendo cards: ${error.message}`);
  return data || [];
}

async function fetchPlayerDetail(futId) {
  const response = await fetch(`${FUT_GG_DETAIL_URL}/${futId}/`);
  if (!response.ok) {
    throw new Error(`fut.gg respondió HTTP ${response.status}`);
  }
  const json = await response.json();
  return json?.data;
}

async function downloadImageBuffer(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function toWebp(rawBuffer) {
  return sharp(rawBuffer).webp({ quality: WEBP_QUALITY }).toBuffer();
}

// Sube (si hace falta) el badge de una entidad (club/nation/league) y
// devuelve su URL pública en Storage. badgeCache evita repetir la
// descarga+subida cuando varias cartas comparten el mismo eaId.
async function resolveBadgeUrl(badgeCache, kind, entity) {
  if (!entity?.eaId || !entity?.imageUrl) return null;

  const cacheKey = `${kind}/${entity.eaId}`;
  if (badgeCache.has(cacheKey)) return badgeCache.get(cacheKey);

  const rawBuffer = await downloadImageBuffer(entity.imageUrl);
  const webpBuffer = await toWebp(rawBuffer);

  const path = `${kind}/${entity.eaId}.webp`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, webpBuffer, { contentType: "image/webp", upsert: true });

  if (uploadError) {
    throw new Error(`Error subiendo ${cacheKey} a Storage: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  badgeCache.set(cacheKey, publicUrl);
  return publicUrl;
}

async function processCard(card, badgeCache) {
  const detail = await fetchPlayerDetail(card.fut_id);
  if (!detail) {
    throw new Error(`sin datos para fut_id=${card.fut_id}`);
  }

  const [clubBadgeUrl, nationFlagUrl, leagueLogoUrl] = await Promise.all([
    resolveBadgeUrl(badgeCache, "club", detail.club),
    resolveBadgeUrl(badgeCache, "nation", detail.nation),
    resolveBadgeUrl(badgeCache, "league", detail.league),
  ]);

  const { error: updateError } = await supabase
    .from("cards")
    .update({
      club_badge_url: clubBadgeUrl,
      nation_flag_url: nationFlagUrl,
      league_logo_url: leagueLogoUrl,
    })
    .eq("id", card.id);

  if (updateError) {
    throw new Error(`Error actualizando cards: ${updateError.message}`);
  }

  return { clubBadgeUrl, nationFlagUrl, leagueLogoUrl };
}

async function run() {
  await ensureBucketExists();

  const cards = await fetchPendingCards(LIMIT);
  console.log(`🛡️  Procesando ${cards.length} carta(s) pendiente(s)...\n`);

  const badgeCache = new Map();
  const stats = { procesados: 0, ok: 0, fallidas: 0 };
  const failures = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];

    try {
      await processCard(card, badgeCache);
      stats.ok += 1;
      console.log(`✅ ${card.name}`);
    } catch (err) {
      stats.fallidas += 1;
      failures.push({ name: card.name, reason: err.message });
      console.log(`❌ ${card.name}: ${err.message}`);
    }

    stats.procesados += 1;

    if (stats.procesados % 20 === 0) {
      console.log(`\n   ... ${stats.procesados}/${cards.length} procesados ...\n`);
    }

    if (i < cards.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  console.log("\n📊 RESUMEN");
  console.log(`   Procesados: ${stats.procesados}`);
  console.log(`   OK:         ${stats.ok}`);
  console.log(`   Fallidas:   ${stats.fallidas}`);
  console.log(`   Badges únicos subidos: ${badgeCache.size}`);

  if (failures.length > 0) {
    console.log("\n   Detalle de fallas:");
    for (const failure of failures) {
      console.log(`   - ${failure.name}: ${failure.reason}`);
    }
  }
}

run();
