// scripts/rate-from-fc26.js
//
// Recalcula el rating de las cartas activas de `cards` usando el OVR
// real de EA FC26 (data/fc26-premier-league.csv, ver
// data/fc26-premier-league.README.md) en vez de la fórmula automática
// de calculateRating() (points_per_game vía FPL), que subvalora
// sistemáticamente a defensores/arqueros de élite.
//
// Prioridad por carta:
//   1. Match contra FC26 (por nombre + posición) -> OVR real de FC26,
//      con piso RATING_FLOOR (65) y techo RATING_CEILING (92).
//   2. Sin match en FC26: fallback a la fórmula vieja, matcheando
//      contra staging_players (source='fpl') como hace
//      scripts/recalibrate-ratings.js.
//   3. Sin match en ninguna fuente: la carta no se toca.
//
// Por defecto corre en modo dry-run (solo imprime el preview). Para
// escribir de verdad en `cards`, correr con --apply:
//   node scripts/rate-from-fc26.js --apply

import fs from "fs";
import path from "path";
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

const FC26_CSV_PATH = path.join("data", "fc26-premier-league.csv");
const FPL_SOURCE = "fpl";
const NAME_SIMILARITY_THRESHOLD = 0.85;
const APPLY = process.argv.includes("--apply");

// ---------------------------------------------------------------------
// Utilidades de nombre (mismas que reconcile.js / recalibrate-ratings.js)
// ---------------------------------------------------------------------
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

function tokenize(text) {
  return normalize(text).split(" ").filter(Boolean);
}

// FC26 usa el nombre de pila completo (ej. "Cole Jermaine Palmer",
// "Erling Braut Håland"), mientras que las cartas suelen usar el
// nombre corto habitual (ej. "Cole Palmer", "Erling Haaland"). Un
// Levenshtein plano sobre el string completo penaliza fuerte esos
// nombres/apellidos de más, así que además comparamos por tokens: si
// (casi) todas las palabras del nombre de la carta aparecen -de forma
// difusa- en el nombre largo de FC26, es un match aunque falte algún
// segundo nombre.
function tokenSubsetScore(cardName, targetName) {
  const cardTokens = tokenize(cardName);
  const targetTokens = tokenize(targetName);
  if (cardTokens.length < 2 || targetTokens.length === 0) return 0;

  // Anclado al apellido: FC26 siempre termina long_name en el
  // apellido real. Sin este anclaje, "bag of words" pura hace falsos
  // positivos entre jugadores distintos cuyo nombre de pila de uno
  // coincide con el segundo nombre de otro (visto en producción:
  // carta "Daniel James" matcheaba contra "James Daniel Maddison"
  // porque "daniel" y "james" aparecen sueltos en ambos nombres).
  const cardSurname = cardTokens[cardTokens.length - 1];
  const targetSurname = targetTokens[targetTokens.length - 1];
  if (cardSurname !== targetSurname && nameSimilarity(cardSurname, targetSurname) < 0.8) return 0;

  let matched = 0;
  for (const ct of cardTokens) {
    const hit = targetTokens.some((tt) => ct === tt || nameSimilarity(ct, tt) >= 0.8);
    if (hit) matched += 1;
  }
  return matched / cardTokens.length;
}

// El mejor de varios métodos de comparación entre el nombre de la
// carta y el candidato FC26 (long_name y short_name): Levenshtein
// sobre el string completo + subset de tokens (ver tokenSubsetScore).
function bestNameScore(cardName, candidate) {
  const scores = [
    nameSimilarity(cardName, candidate.long_name),
    tokenSubsetScore(cardName, candidate.long_name),
  ];
  if (candidate.short_name) {
    scores.push(nameSimilarity(cardName, candidate.short_name));
    scores.push(tokenSubsetScore(cardName, candidate.short_name));
  }
  return Math.max(...scores);
}

function findBestMatch(cardName, candidates, scoreFn) {
  let best = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = scoreFn(cardName, candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return bestScore >= NAME_SIMILARITY_THRESHOLD ? best : null;
}

// ---------------------------------------------------------------------
// CSV parsing (sin dependencias: soporta campos con comas entre comillas)
// ---------------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (c === "\r") {
      // skip
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Posición de club en FC26 (LCB, RDM, ST, etc., más "RES"/"SUB" para
// suplentes) -> misma bucket de 4 posiciones que usa `cards`.
const POSITION_BUCKET = {
  GK: "POR",
  CB: "DEF", LCB: "DEF", RCB: "DEF", LB: "DEF", RB: "DEF", LWB: "DEF", RWB: "DEF", SW: "DEF",
  CDM: "MED", LDM: "MED", RDM: "MED", CM: "MED", LCM: "MED", RCM: "MED",
  CAM: "MED", LAM: "MED", RAM: "MED", LM: "MED", RM: "MED",
  ST: "DEL", LS: "DEL", RS: "DEL", CF: "DEL", LF: "DEL", RF: "DEL", LW: "DEL", RW: "DEL",
};

// Devuelve TODAS las buckets posibles del jugador (club_position +
// cada posición listada en player_positions), no solo la primera:
// muchos jugadores (wingers, carrileros) están listados como "RW, CM,
// LW, RM" y su club_position puede ser "SUB"/"RES" (suplente, sin
// info útil). Si tomáramos una sola, un mediocampista en `cards` que
// FC26 lista primero como extremo (bucket DEL) nunca matchearía.
function fc26PositionBuckets(row) {
  const buckets = new Set();
  if (POSITION_BUCKET[row.club_position]) buckets.add(POSITION_BUCKET[row.club_position]);
  for (const pos of (row.player_positions || "").split(",")) {
    const bucket = POSITION_BUCKET[pos.trim()];
    if (bucket) buckets.add(bucket);
  }
  return buckets;
}

function loadFc26Players() {
  const text = fs.readFileSync(FC26_CSV_PATH, "utf-8");
  const rows = parseCsv(text);
  const header = rows[0];
  const idx = (name) => header.indexOf(name);
  const iLongName = idx("long_name");
  const iShortName = idx("short_name");
  const iOverall = idx("overall");
  const iClub = idx("club_name");
  const iPositions = idx("player_positions");
  const iClubPos = idx("club_position");

  const players = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < header.length) continue;
    const row = {
      long_name: r[iLongName],
      short_name: r[iShortName],
      overall: parseInt(r[iOverall], 10),
      club: r[iClub],
      player_positions: r[iPositions],
      club_position: r[iClubPos],
    };
    row.buckets = fc26PositionBuckets(row);
    players.push(row);
  }
  return players;
}

async function fetchAll(query) {
  const { data, error } = await query;
  if (error) {
    console.error("❌ Error leyendo de Supabase:", error.message);
    process.exit(1);
  }
  return data || [];
}

function clampRating(value) {
  return Math.max(RATING_FLOOR, Math.min(RATING_CEILING, value));
}

const WELL_KNOWN = [
  "van dijk", "haaland", "cole palmer", "isak", "gabriel fernando de jesus",
  "ødegaard", "declan rice", "alisson becker", "donnarumma", "florian wirtz",
  "phil foden", "bruno borges fernandes", "bukayo saka", "ollie watkins",
  "mbeumo", "saliba", "martinelli",
];

async function run() {
  const [cards, fplStaging] = await Promise.all([
    fetchAll(
      supabase.from("cards").select("id, name, club, position, overall_rating").eq("is_active", true)
    ),
    fetchAll(
      supabase.from("staging_players").select("name, position, raw_data").eq("source", FPL_SOURCE)
    ),
  ]);
  const fc26Players = loadFc26Players();

  console.log(
    `📦 ${cards.length} cartas activas en cards, ${fc26Players.length} jugadores FC26 (Premier League), ${fplStaging.length} en staging (source='fpl').`
  );

  const results = [];
  let fc26Matched = 0;
  let fplFallback = 0;
  let unchanged = 0;

  for (const card of cards) {
    const fc26Candidates = fc26Players.filter((p) => p.buckets.has(card.position));
    const fc26Match = findBestMatch(card.name, fc26Candidates, bestNameScore);

    if (fc26Match) {
      fc26Matched += 1;
      const after = clampRating(fc26Match.overall);
      results.push({
        id: card.id,
        name: card.name,
        club: card.club,
        position: card.position,
        before: card.overall_rating,
        after,
        source: "fc26",
        detail: `FC26 OVR=${fc26Match.overall} (${fc26Match.long_name}, ${fc26Match.club})`,
      });
      continue;
    }

    const fplCandidates = fplStaging.filter((sp) => sp.position === card.position);
    const fplMatch = findBestMatch(card.name, fplCandidates, (name, c) => nameSimilarity(name, c.name));

    if (fplMatch) {
      fplFallback += 1;
      const after = calculateRating(toPlayerStats(fplMatch.raw_data));
      results.push({
        id: card.id,
        name: card.name,
        club: card.club,
        position: card.position,
        before: card.overall_rating,
        after,
        source: "fpl_formula",
        detail: `ppg=${fplMatch.raw_data.points_per_game}`,
      });
      continue;
    }

    unchanged += 1;
  }

  console.log("\n📊 RESUMEN DE MATCHING");
  console.log(`   Matcheados vs FC26 (OVR real):        ${fc26Matched}`);
  console.log(`   Fallback a fórmula FPL (points_per_game): ${fplFallback}`);
  console.log(`   Sin match en ninguna fuente (sin cambios): ${unchanged}`);
  console.log(`   Total cartas activas:                  ${cards.length}`);

  console.log("\n🔍 Jugadores conocidos (chequeo manual):");
  for (const needle of WELL_KNOWN) {
    const hit = results.find((r) => normalize(r.name).includes(normalize(needle)));
    if (hit) {
      console.log(
        `   ${hit.name.padEnd(28)} ${hit.position}  [${hit.source}]  ${hit.before} → ${hit.after}   (${hit.detail})`
      );
    }
  }

  console.log("\n🔍 Muestra adicional random de matches FC26 (10):");
  const fc26Results = results.filter((r) => r.source === "fc26");
  const sampleSize = Math.min(10, fc26Results.length);
  const shuffled = [...fc26Results].sort(() => Math.random() - 0.5).slice(0, sampleSize);
  for (const r of shuffled) {
    console.log(`   ${r.name.padEnd(28)} ${r.position}  ${r.before} → ${r.after}   (${r.detail})`);
  }

  const tierCounts = { BRONZE: 0, SILVER: 0, GOLD: 0, SPECIAL: 0 };
  const outOfRange = [];
  for (const r of results) {
    tierCounts[getTier(r.after)] += 1;
    if (r.after < RATING_FLOOR || r.after > RATING_CEILING) outOfRange.push(r);
  }

  console.log("\n🎖️  Distribución por banda (de las cartas que cambiarían):");
  for (const [tier, range] of Object.entries(RATING_TIERS)) {
    console.log(`   ${tier.padEnd(8)} (${range.min}-${range.max}): ${tierCounts[tier]}`);
  }

  if (outOfRange.length > 0) {
    console.warn(`\n⚠️  ${outOfRange.length} carta(s) quedaron fuera del rango ${RATING_FLOOR}-${RATING_CEILING} (no debería pasar):`);
    for (const r of outOfRange) {
      console.warn(`   - ${r.name}: ${r.after}`);
    }
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

  console.log("\n📊 RESUMEN FINAL");
  console.log(`   Actualizadas: ${updated}`);
  console.log(`   Sin cambios:  ${unchanged}`);
  if (failed > 0) {
    console.log(`   Fallidas:     ${failed}`);
  }
}

run();
