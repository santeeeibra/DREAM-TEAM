// ============================================
// DREAM TEAM - Scraper Sofascore → SQL para Supabase
// Ejecutar: node scrape-sofascore.js > inserts.sql
// ============================================

const RAPIDAPI_KEY = '904904d7a8msh160c6439432dca3p137ed9jsne70eed73ed54';
const RAPIDAPI_HOST = 'sofascore.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

// Tus 7 ligas con sus uniqueTournament IDs de Sofascore
const LEAGUES = [
  { id: 17,  name: 'Premier League',   country: 'England',   countryCode: 'EN' },
  { id: 8,   name: 'LaLiga',           country: 'Spain',     countryCode: 'ES' },
  { id: 23,  name: 'Serie A',          country: 'Italy',     countryCode: 'IT' },
  { id: 35,  name: 'Bundesliga',       country: 'Germany',   countryCode: 'DE' },
  { id: 155, name: 'Liga Profesional', country: 'Argentina', countryCode: 'AR' },
  { id: 242, name: 'MLS',              country: 'USA',       countryCode: 'US' },
  { id: 34,  name: 'Ligue 1',          country: 'France',    countryCode: 'FR' },
];

// Pausa entre requests para no saturar (ms)
const DELAY = 2000; // 2 segundos entre requests
const RETRY_DELAY = 30000; // 30 segundos si hay rate limit
const MAX_RETRIES = 3;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Fetch genérico con retry para 429
async function apiFetch(url, retryCount = 0) {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': RAPIDAPI_KEY,
    },
  });
  if (res.status === 429 && retryCount < MAX_RETRIES) {
    console.error(`  ⏳ Rate limit, esperando 30s... (intento ${retryCount + 1}/${MAX_RETRIES})`);
    await sleep(RETRY_DELAY);
    return apiFetch(url, retryCount + 1);
  }
  if (!res.ok) {
    console.error(`-- ERROR ${res.status} en ${url}`);
    return null;
  }
  return res.json();
}

// Escapar strings para SQL
function esc(str) {
  if (str == null) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

// Convertir timestamp Unix a fecha SQL
function tsToDate(ts) {
  if (!ts) return 'NULL';
  const d = new Date(ts * 1000);
  return `'${d.toISOString().split('T')[0]}'`;
}

// Convertir dateOfBirth string a fecha SQL
function dobToDate(dob) {
  if (!dob) return 'NULL';
  return `'${dob.split('T')[0]}'`;
}

async function main() {
  const allTeams = [];
  const allPlayers = [];

  // ── PASO 1: Obtener seasonId actual de cada liga ──
  console.log('-- ============================================');
  console.log('-- DREAM TEAM - Datos importados de Sofascore');
  console.log(`-- Fecha: ${new Date().toISOString().split('T')[0]}`);
  console.log('-- ============================================\n');

  for (const league of LEAGUES) {
    console.error(`[1/3] Obteniendo seasons de ${league.name}...`);
    const seasonsData = await apiFetch(
      `${BASE_URL}/tournaments/get-seasons?tournamentId=${league.id}`
    );
    await sleep(DELAY);

    if (!seasonsData?.seasons?.length) {
      console.error(`  ⚠ No se encontraron seasons para ${league.name}`);
      continue;
    }

    // La primera season es la actual
    const currentSeason = seasonsData.seasons[0];
    league.seasonId = currentSeason.id;
    league.seasonName = currentSeason.name;
    console.error(`  ✓ ${league.seasonName} (seasonId: ${league.seasonId})`);
  }

  // ── PASO 2: Obtener equipos de cada liga via standings ──
  for (const league of LEAGUES) {
    if (!league.seasonId) continue;

    console.error(`[2/3] Obteniendo equipos de ${league.name}...`);
    const standingsData = await apiFetch(
      `${BASE_URL}/tournaments/get-standings?tournamentId=${league.id}&seasonId=${league.seasonId}&type=total`
    );
    await sleep(DELAY);

    if (!standingsData?.standings?.[0]?.rows) {
      console.error(`  ⚠ No se encontraron standings para ${league.name}`);
      continue;
    }

    const rows = standingsData.standings[0].rows;
    console.error(`  ✓ ${rows.length} equipos encontrados`);

    for (const row of rows) {
      const t = row.team;
      allTeams.push({
        id: t.id,
        leagueId: league.id,
        name: t.name,
        shortName: t.shortName || t.name,
        nameCode: t.nameCode || null,
        slug: t.slug || null,
        country: league.country,
        countryCode: league.countryCode,
        primaryColor: t.teamColors?.primary || null,
        secondaryColor: t.teamColors?.secondary || null,
        textColor: t.teamColors?.text || null,
      });
    }
  }

  // ── PASO 3: Obtener plantilla de cada equipo ──
  let teamCount = 0;
  for (const team of allTeams) {
    teamCount++;
    console.error(`[3/3] Plantilla ${teamCount}/${allTeams.length}: ${team.name}...`);

    const squadData = await apiFetch(
      `${BASE_URL}/teams/get-squad?teamId=${team.id}`
    );
    await sleep(DELAY);

    if (!squadData?.players?.length) {
      console.error(`  ⚠ Sin jugadores para ${team.name}`);
      continue;
    }

    console.error(`  ✓ ${squadData.players.length} jugadores`);

    for (const entry of squadData.players) {
      const p = entry.player;
      if (!p) continue;

      allPlayers.push({
        id: p.id,
        teamId: team.id,
        name: p.name,
        shortName: p.shortName || p.name,
        slug: p.slug || null,
        position: p.position || null,
        positionsDetailed: p.positionsDetailed || entry.positionsDetailed || [],
        dateOfBirth: p.dateOfBirth || null,
        height: p.height || null,
        preferredFoot: p.preferredFoot || null,
        country: p.country?.name || null,
        countryCode: p.country?.alpha2 || null,
        jerseyNumber: p.jerseyNumber || entry.shirtNumber || null,
        marketValue: p.proposedMarketValue || entry.proposedMarketValue || null,
        contractUntil: entry.contractUntilTimestamp || null,
      });
    }
  }

  // ── GENERAR SQL ──
  console.log('-- EQUIPOS');
  console.log(`-- Total: ${allTeams.length}\n`);

  for (const t of allTeams) {
    console.log(`INSERT INTO teams (id, league_id, name, short_name, name_code, slug, country, country_code, primary_color, secondary_color, text_color)
VALUES (${t.id}, ${t.leagueId}, ${esc(t.name)}, ${esc(t.shortName)}, ${esc(t.nameCode)}, ${esc(t.slug)}, ${esc(t.country)}, ${esc(t.countryCode)}, ${esc(t.primaryColor)}, ${esc(t.secondaryColor)}, ${esc(t.textColor)})
ON CONFLICT (id) DO UPDATE SET name=${esc(t.name)}, short_name=${esc(t.shortName)}, updated_at=NOW();\n`);
  }

  console.log('\n-- JUGADORES');
  console.log(`-- Total: ${allPlayers.length}\n`);

  for (const p of allPlayers) {
    const posArr = p.positionsDetailed.length
      ? `ARRAY[${p.positionsDetailed.map(x => esc(x)).join(',')}]`
      : 'NULL';

    console.log(`INSERT INTO players (id, team_id, name, short_name, slug, position, positions_detailed, date_of_birth, height, preferred_foot, country, country_code, jersey_number, market_value, contract_until)
VALUES (${p.id}, ${p.teamId}, ${esc(p.name)}, ${esc(p.shortName)}, ${esc(p.slug)}, ${esc(p.position)}, ${posArr}, ${dobToDate(p.dateOfBirth)}, ${p.height || 'NULL'}, ${esc(p.preferredFoot)}, ${esc(p.country)}, ${esc(p.countryCode)}, ${p.jerseyNumber || 'NULL'}, ${p.marketValue || 'NULL'}, ${tsToDate(p.contractUntil)})
ON CONFLICT (id) DO UPDATE SET team_id=${p.teamId}, name=${esc(p.name)}, position=${esc(p.position)}, positions_detailed=${posArr}, market_value=${p.marketValue || 'NULL'}, jersey_number=${p.jerseyNumber || 'NULL'}, updated_at=NOW();\n`);
  }

  console.log('\n-- ✓ Scraping completado');
  console.log(`-- ${allTeams.length} equipos, ${allPlayers.length} jugadores`);

  // Resumen en stderr
  console.error('\n========================================');
  console.error(`✓ LISTO: ${allTeams.length} equipos, ${allPlayers.length} jugadores`);
  console.error('Ejecutá el SQL generado en Supabase SQL Editor');
  console.error('========================================');
}

main().catch(e => console.error('Error fatal:', e));
