import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.API_FOOTBALL_KEY;

const LEAGUES = [
  { id: 39, name: "Premier League" },
  { id: 140, name: "La Liga" },
  { id: 135, name: "Serie A" },
  { id: 78, name: "Bundesliga" },
  { id: 61, name: "Ligue 1" },
];

const SEASON = 2023; // antes: 2025
const SEED_FILE = path.join("data", "players-seed.json");
const SQL_FILE = path.join("data", "insert-players.sql");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Métrica base del rating: points_per_game en el pipeline FPL (via
// toPlayerStats en apply-approved.js), rating de partido de
// API-Football en fetchPlayers() de este archivo. Ambas llegan por el
// mismo campo (games.rating) para que calculateRating no necesite
// saber de qué fuente vienen.
export function extractRatingMetric(playerStats) {
  return parseFloat(playerStats.games?.rating) || 0;
}

// =====================================================================
// ANCLA FIJA — leer esto antes de tocar calculateRating()
//
// El rating de una carta se calcula contra un valor de referencia FIJO
// (REFERENCE_MAX_POINTS_PER_GAME), constante en el código. NO se
// normaliza contra el mínimo/máximo ni el promedio del dataset actual.
//
// Por qué importa: si normalizáramos contra el pool de jugadores
// cargados hoy (como hacía la versión vieja de esta función, con un
// z-score por posición), el rating de una carta que un usuario ya
// tiene en su plantel se movería solo, retroactivamente, el día que
// agreguemos más jugadores (Fase 6: otras ligas vía API-Football) y el
// mínimo/máximo/promedio del pool cambie. Con un ancla fija eso no
// puede pasar: el mismo points_per_game SIEMPRE da el mismo rating,
// sin importar qué otros jugadores existan en la base en ese momento.
//
// Si en Fase 6 se mapean stats de API-Football (games.rating, escala
// ~0-10, distinta a points_per_game de FPL) hay que definir su propia
// constante de referencia equivalente — NO reutilizar ni recalibrar
// REFERENCE_MAX_POINTS_PER_GAME, y sobre todo NO volver a un esquema
// relativo al dataset (min/max, mean/stddev, percentil, etc.).
// =====================================================================
export const REFERENCE_MAX_POINTS_PER_GAME = 6.5; // valor típico de un jugador élite en FPL
export const RATING_FLOOR = 65;
export const RATING_CEILING = 92;
const RATING_RANGE = RATING_CEILING - RATING_FLOOR; // 27

// Bandas de rareza en base al rating final. Viven en src/shared/ratingTiers.js
// (sin dependencias de Node) para que el mismo getTier() lo use tanto este
// script como la UI (CardSprite.js, color de carta). Se reexportan acá para
// no romper los imports existentes (ej. scripts/recalibrate-ratings.js).
export { RATING_TIERS, getTier } from "../src/shared/ratingTiers.js";

export function calculateRating(playerStats) {
  const rawScore = Math.min(extractRatingMetric(playerStats), REFERENCE_MAX_POINTS_PER_GAME);
  const normalized = rawScore / REFERENCE_MAX_POINTS_PER_GAME; // 0 a 1

  let rating = RATING_FLOOR + Math.round(normalized * RATING_RANGE);

  // Clamp de seguridad: nunca debe faltar, aunque en teoría la fórmula
  // de arriba ya nunca se sale de [RATING_FLOOR, RATING_CEILING].
  rating = Math.max(RATING_FLOOR, Math.min(RATING_CEILING, rating));
  return rating;
}

async function fetchPlayers() {
  let existingPlayers = [];
  if (fs.existsSync(SEED_FILE)) {
    try {
      const data = fs.readFileSync(SEED_FILE, "utf-8");
      existingPlayers = JSON.parse(data);
      console.log(`📦 Reanudando... Se encontraron ${existingPlayers.length} jugadores guardados previa/e.`);
    } catch (e) {
      existingPlayers = [];
    }
  }

  // Jugadores obtenidos en ESTA corrida (no los que ya venían cacheados
  // en SEED_FILE de corridas previas). El z-score se calcula sobre este
  // pool: guardamos las statistics crudas y recién calculamos el rating
  // al final, cuando ya sabemos mean/stddev por posición del pool
  // completo.
  const freshlyFetched = [];

  for (const league of LEAGUES) {
    const currentLeaguePlayers = existingPlayers.filter((p) => p.leagueId === league.id);

    if (currentLeaguePlayers.length >= 40) {
      console.log(`✅ Liga ${league.name} ya completa en el cache (${currentLeaguePlayers.length} jugadores).`);
      continue;
    }

    console.log(`⚽ Obteniendo jugadores para ${league.name} (Season ${SEASON})...`);

    for (let page = 1; page <= 2; page++) {
      const url = `https://v3.football.api-sports.io/players?league=${league.id}&season=${SEASON}&page=${page}`;

      try {
        const response = await fetch(url, {
          headers: {
            "x-apisports-key": API_KEY
          },
        });

        const json = await response.json();

        if (json.errors && Object.keys(json.errors).length > 0) {
          console.error(`❌ Error de la API:`, json.errors);
          break;
        }

        const responseList = json.response || [];

        for (const item of responseList) {
          const player = item.player;
          const statistics = item.statistics[0] || {};
          const pos = statistics.games?.position || "Midfielder";

          freshlyFetched.push({
            name: player.name,
            club: statistics.team?.name || "Desconocido",
            position: pos,
            statistics,
            leagueName: league.name,
            leagueId: league.id,
          });
        }

        console.log(`   Página ${page}/2 procesada. Total nuevo acumulado: ${freshlyFetched.length}`);

        await sleep(1500);
      } catch (err) {
        console.error(`❌ Error al consultar ${league.name} pág ${page}:`, err.message);
      }
    }
  }

  for (const p of freshlyFetched) {
    existingPlayers.push({
      name: p.name,
      club: p.club,
      position: p.position,
      rating: calculateRating(p.statistics),
      leagueName: p.leagueName,
      leagueId: p.leagueId,
    });
  }

  fs.writeFileSync(SEED_FILE, JSON.stringify(existingPlayers, null, 2));

  console.log("\n📝 Generando archivo insert-players.sql...");
  let sqlContent = `-- Script generado automáticamente (Season ${SEASON})\n`;
  sqlContent += `INSERT INTO cards (name, club, position, rating) VALUES\n`;

  const valuesSql = existingPlayers.map((p) => {
    const safeName = p.name.replace(/'/g, "''");
    const safeClub = p.club.replace(/'/g, "''");
    return `  ('${safeName}', '${safeClub}', '${p.position}', ${p.rating})`;
  });

  sqlContent += valuesSql.join(",\n") + `;\n`;

  fs.writeFileSync(SQL_FILE, sqlContent);
  console.log(`✅ SQL guardado exitosamente en ${SQL_FILE}`);

  console.log("\n📊 RESUMEN FINAL:");
  console.log(`Total jugadores: ${existingPlayers.length}`);
  
  const byPosition = {};
  existingPlayers.forEach((p) => {
    byPosition[p.position] = (byPosition[p.position] || 0) + 1;
  });
  console.log("Por posición:", byPosition);
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  if (!API_KEY) {
    console.error("❌ ERROR: No se encontró API_FOOTBALL_KEY en el archivo .env");
    process.exit(1);
  }
  fetchPlayers();
}
