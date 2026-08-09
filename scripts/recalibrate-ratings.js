// scripts/recalibrate-ratings.js
//
// One-off: recalcula el rating de TODAS las cartas activas de `cards`
// con la fórmula de ancla fija de calculateRating() (ver
// scripts/seed-players.js), usando el points_per_game vigente en
// staging_players (source='fpl') como métrica base.
//
// No toca pending_changes ni pasa por apply-approved.js: es un
// recálculo masivo directo sobre `cards`, no una revisión.
//
// Por defecto corre en modo dry-run (solo imprime qué cambiaría). Para
// escribir de verdad en `cards`, correr con --apply:
//   node scripts/recalibrate-ratings.js --apply

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { calculateRating, RATING_FLOOR, RATING_CEILING, RATING_TIERS, getTier } from "./seed-players.js";
import { toPlayerStats } from "./apply-approved.js";

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

const SOURCE = "fpl";
const NAME_SIMILARITY_THRESHOLD = 0.85;
const APPLY = process.argv.includes("--apply");

// Mismo matching por nombre que scripts/reconcile.js (Levenshtein
// normalizado): los nombres pueden venir con acentos o formato
// distinto entre FPL y el catálogo. Acá además restringimos los
// candidatos a la misma posición que la carta, porque un match
// cruzado de posición podría asignar el points_per_game de otro
// jugador.
function normalize(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const currRow = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1,
        prevRow[j] + 1,
        prevRow[j - 1] + cost
      );
    }
    prevRow = currRow;
  }
  return prevRow[n];
}

function nameSimilarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  const maxLen = Math.max(na.length, nb.length, 1);
  return 1 - levenshtein(na, nb) / maxLen;
}

function findBestMatch(name, candidates) {
  let best = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = nameSimilarity(name, candidate.name);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return bestScore >= NAME_SIMILARITY_THRESHOLD ? best : null;
}

async function fetchAll(query) {
  const { data, error } = await query;
  if (error) {
    console.error("❌ Error leyendo de Supabase:", error.message);
    process.exit(1);
  }
  return data || [];
}

function pickRandom(list, n) {
  const pool = [...list];
  const picked = [];
  while (picked.length < n && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

async function recalibrate() {
  const [cards, stagingPlayers] = await Promise.all([
    fetchAll(
      supabase
        .from("cards")
        .select("id, name, club, position, overall_rating")
        .eq("is_active", true)
    ),
    fetchAll(
      supabase
        .from("staging_players")
        .select("name, position, raw_data")
        .eq("source", SOURCE)
    ),
  ]);

  console.log(
    `📦 ${cards.length} cartas activas en cards, ${stagingPlayers.length} jugadores en staging (source='${SOURCE}').`
  );

  const results = [];
  let unmatched = 0;

  for (const card of cards) {
    const candidates = stagingPlayers.filter((sp) => sp.position === card.position);
    const match = findBestMatch(card.name, candidates);

    if (!match) {
      unmatched += 1;
      continue;
    }

    const newRating = calculateRating(toPlayerStats(match.raw_data));

    results.push({
      id: card.id,
      name: card.name,
      club: card.club,
      position: card.position,
      pointsPerGame: match.raw_data.points_per_game,
      before: card.overall_rating,
      after: newRating,
    });
  }

  console.log(
    `✅ ${results.length} cartas matcheadas contra staging, ${unmatched} sin match (quedan con su rating actual).`
  );

  // Verificación a ojo antes de tocar las 564 cartas reales.
  const haaland = results.find((r) => normalize(r.name).includes("haaland"));
  const bruno = results.find((r) => normalize(r.name).includes("bruno fernandes"));
  const rest = results.filter((r) => r !== haaland && r !== bruno);
  const sample = [haaland, bruno, ...pickRandom(rest, 8)].filter(Boolean).slice(0, 10);

  console.log("\n🔍 Muestra antes/después (10 jugadores):");
  for (const r of sample) {
    console.log(
      `   ${r.name.padEnd(24)} ${r.position}  ppg=${r.pointsPerGame}  ${r.before} → ${r.after}`
    );
  }

  // Distribución por banda + chequeo de seguridad: con la ancla fija
  // (RATING_FLOOR/RATING_CEILING en seed-players.js) ningún rating
  // debería caer fuera de rango, pero lo verificamos igual.
  const tierCounts = { BRONZE: 0, SILVER: 0, GOLD: 0, SPECIAL: 0 };
  const outOfRange = [];
  for (const r of results) {
    tierCounts[getTier(r.after)] += 1;
    if (r.after < RATING_FLOOR || r.after > RATING_CEILING) outOfRange.push(r);
  }

  console.log("\n🎖️  Distribución por banda:");
  for (const [tier, range] of Object.entries(RATING_TIERS)) {
    console.log(`   ${tier.padEnd(8)} (${range.min}-${range.max}): ${tierCounts[tier]}`);
  }

  if (outOfRange.length > 0) {
    console.warn(`\n⚠️  ${outOfRange.length} carta(s) quedaron fuera del rango ${RATING_FLOOR}-${RATING_CEILING} (no debería pasar):`);
    for (const r of outOfRange) {
      console.warn(`   - ${r.name}: ${r.after}`);
    }
  } else {
    console.log(`\n✅ Todos los ratings quedaron dentro del rango ${RATING_FLOOR}-${RATING_CEILING}.`);
  }

  if (!APPLY) {
    console.log("\n🧪 Dry-run (no se escribió nada). Correr con --apply para aplicar los cambios a cards.");
    return;
  }

  console.log(`\n✏️  Aplicando ${results.length} actualizaciones a cards...`);
  let updated = 0;
  let failed = 0;

  for (const r of results) {
    const { error } = await supabase
      .from("cards")
      .update({
        pace: r.after,
        shooting: r.after,
        passing: r.after,
        defense: r.after,
        physical: r.after,
        goalkeeping: r.after,
      })
      .eq("id", r.id);

    if (error) {
      failed += 1;
      console.error(`❌ Falló ${r.name} (${r.id}):`, error.message);
    } else {
      updated += 1;
    }
  }

  console.log("\n📊 RESUMEN");
  console.log(`   Actualizadas: ${updated}`);
  console.log(`   Sin match:    ${unmatched}`);
  if (failed > 0) {
    console.log(`   Fallidas:     ${failed}`);
  }
}

recalibrate();
