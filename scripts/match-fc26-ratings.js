// scripts/match-fc26-ratings.js
//
// Cruza `cards` (Supabase) contra un CSV de FC26 descargado a mano de
// Kaggle (scripts/data/fc26-players.csv) para generar candidatos de
// match: overall real, club, posición y un ID numérico candidato a
// fut_id por carta.
//
// A diferencia de rate-from-fc26.js / recalibrate-ratings.js, este
// script es de SOLO LECTURA contra Supabase: no escribe nada en
// `cards`. Vuelca los resultados a dos JSON locales para revisión
// manual antes de confiar en el matching:
//   - scripts/data/fut-matches.json   → cartas matcheadas
//   - scripts/data/fut-unmatched.json → cartas sin candidato (quedan
//     con avatar de iniciales)
//
//   node scripts/match-fc26-ratings.js

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";

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

// ---------------------------------------------------------------------
// Config — ajustar acá una vez que tengas el CSV de Kaggle delante y
// confirmes los nombres reales de columna. Los de abajo son los
// habituales en los datasets de FC26 de Kaggle (mismo formato que
// data/fc26-premier-league.csv, que ya usa rate-from-fc26.js).
// ---------------------------------------------------------------------
const CSV_PATH = path.join("scripts", "data", "fc26-players.csv");
const OUTPUT_DIR = path.join("scripts", "data");
const MATCHES_PATH = path.join(OUTPUT_DIR, "fut-matches.json");
const UNMATCHED_PATH = path.join(OUTPUT_DIR, "fut-unmatched.json");

const CSV_COLUMNS = {
  fullName: "long_name",
  shortName: "short_name", // opcional: si el CSV no la trae, se ignora
  overall: "overall",
  club: "club_name",
  position: "player_positions",
  futId: "player_id",
};

// Umbral de similaridad de CLUB (paso 1 del matching): dos clubes
// matchean si el string normalizado es idéntico, o si nameSimilarity
// da 0.6 o más (cubre variantes tipo "Man United" vs "Manchester
// United", "Spurs" vs "Tottenham Hotspur" queda afuera a propósito:
// no son textualmente parecidos, esos casos los resuelve el paso 3
// global).
const CLUB_SIMILARITY_THRESHOLD = 0.6;

// Umbral de nombre para el paso 2 (candidatos ya filtrados por club):
// como el universo de candidatos es chico, alcanza con un umbral más
// laxo que en el paso 3 global.
const CLUB_FUZZY_NAME_THRESHOLD = 0.7;

// Umbral de nombre para el paso 3 (fallback sin filtro de club, CSV
// entero): acá hace falta ser mucho más estricto porque el universo
// son ~18k jugadores de todas las ligas, así que además se exige que
// tokenSubsetScore() no descarte el candidato (ver más abajo).
const GLOBAL_FUZZY_NAME_THRESHOLD = 0.9;

// Cuántos matches fuzzy de cada tipo (fuzzy_club / fuzzy_global)
// mostrar al final para chequear a ojo si los umbrales están bien
// calibrados antes de confiar en el resto.
const FUZZY_SAMPLE_SIZE = 8;

// Mismo mapeo posición-FC26 -> bucket de 4 posiciones que usa `cards`
// (POR/DEF/MED/DEL), copiado de rate-from-fc26.js: se usa solo para
// desempatar cuando hay más de un candidato por encima del umbral.
const POSITION_BUCKET = {
  GK: "POR",
  DEF: "DEF", LCB: "DEF", RCB: "DEF", LB: "DEF", RB: "DEF", LWB: "DEF", RWB: "DEF", SW: "DEF",
  CDM: "MED", LDM: "MED", RDM: "MED", CM: "MED", LCM: "MED", RCM: "MED",
  CAM: "MED", LAM: "MED", RAM: "MED", LM: "MED", RM: "MED",
  ST: "DEL", LS: "DEL", RS: "DEL", CF: "DEL", LF: "DEL", RF: "DEL", LW: "DEL", RW: "DEL",
};

// Diccionario fijo de alias de clubes: mapea el nombre que usa la carta
// (ej. "Spurs", "Man City") al nombre canónico que aparece en el CSV de
// FC26. Se aplica ANTES de la comparación difusa, así los casos que el
// umbral de similaridad no puede resolver (baja similitud de string)
// matchean igual por nombre canónico.
const CLUB_ALIASES = {
  "arsenal": "arsenal",
  "aston villa": "aston villa",
  "bournemouth": "afc bournemouth",
  "brentford": "brentford",
  "brighton": "brighton & hove albion",
  "chelsea": "chelsea",
  "coventry city": "coventry city",
  "crystal palace": "crystal palace",
  "everton": "everton",
  "fulham": "fulham",
  "hull city": "hull city",
  "ipswich town": "ipswich town",
  "leeds": "leeds united",
  "liverpool": "liverpool",
  "man city": "manchester city",
  "man utd": "manchester united",
  "newcastle": "newcastle united",
  "nott'm forest": "nottingham forest",
  "spurs": "tottenham hotspur",
  "sunderland": "sunderland"
};

// ---------------------------------------------------------------------
// Normalización / similaridad de nombres — copiadas TAL CUAL de
// rate-from-fc26.js (normalize, levenshtein, nameSimilarity, tokenize,
// tokenSubsetScore) para no divergir del criterio que ya usa ese
// script. No se importan directamente porque rate-from-fc26.js corre
// run() (y valida env de Supabase) apenas se lo importa, y este script
// no debe disparar eso.
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

// Compara contra long_name Y short_name (si existe) y devuelve el que
// mejor puntúa: las cards suelen usar el nombre corto habitual
// ("Bruno Fernandes"), mientras que long_name trae el nombre de pila
// completo ("Bruno Miguel Borges Fernandes"), y comparar solo contra
// ese último penaliza de más a los nombres largos.
function bestNameMatch(cardName, csvRow) {
  const candidates = [csvRow[CSV_COLUMNS.fullName]];
  if (csvRow[CSV_COLUMNS.shortName]) candidates.push(csvRow[CSV_COLUMNS.shortName]);

  let best = { value: null, score: 0 };
  for (const value of candidates) {
    const score = nameSimilarity(cardName, value);
    if (score > best.score) best = { value, score };
  }
  return best;
}

// Filtro de anclaje por apellido (paso 3 global): true si alguno de
// long_name/short_name del candidato comparte apellido con la carta
// (o muy similar), vía tokenSubsetScore() de rate-from-fc26.js. Sin
// esto, con 18k jugadores en el CSV, un umbral fuzzy alto igual puede
// producir falsos positivos entre nombres parecidos pero de personas
// distintas.
function passesSurnameAnchor(cardName, csvRow) {
  const candidates = [csvRow[CSV_COLUMNS.fullName]];
  if (csvRow[CSV_COLUMNS.shortName]) candidates.push(csvRow[CSV_COLUMNS.shortName]);
  return candidates.some((value) => tokenSubsetScore(cardName, value) > 0);
}

// Club = mismo tratamiento de texto que el nombre (paso 1 del
// matching): normalizado idéntico, o nameSimilarity >= umbral.
function clubsMatch(cardClub, csvClub) {
  const normalizedCardClub = CLUB_ALIASES[cardClub.toLowerCase()] || cardClub;
  const a = normalize(normalizedCardClub);
  const b = normalize(csvClub);
  if (!a || !b) return false;
  return a === b || nameSimilarity(normalizedCardClub, csvClub) >= CLUB_SIMILARITY_THRESHOLD;
}

function csvPositionBuckets(csvRow) {
  const buckets = new Set();
  for (const pos of (csvRow[CSV_COLUMNS.position] || "").split(",")) {
    const bucket = POSITION_BUCKET[pos.trim()];
    if (bucket) buckets.add(bucket);
  }
  return buckets;
}

function positionMatches(cardPosition, csvRow) {
  return csvPositionBuckets(csvRow).has(cardPosition);
}

// ---------------------------------------------------------------------
// Carga del CSV
// ---------------------------------------------------------------------
function loadFc26Csv() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(
      `❌ ERROR: no se encontró el CSV en ${CSV_PATH}.\n` +
        "   Descargalo de Kaggle y guardalo en esa ruta."
    );
    process.exit(1);
  }

  const text = fs.readFileSync(CSV_PATH, "utf-8");
  const { data, errors, meta } = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (errors.length > 0) {
    console.warn(`⚠️  papaparse reportó ${errors.length} fila(s) con problemas de formato (se ignoran):`);
    for (const err of errors.slice(0, 5)) {
      console.warn(`   - fila ${err.row}: ${err.message}`);
    }
  }

  // Chequeo temprano de nombres de columna: si Kaggle cambió algún
  // header (o CSV_COLUMNS quedó desactualizado), mejor cortar acá con
  // un mensaje claro que dejar que el matching falle en silencio.
  const requiredKeys = Object.keys(CSV_COLUMNS).filter((key) => key !== "shortName");
  const missingColumns = requiredKeys
    .map((key) => CSV_COLUMNS[key])
    .filter((column) => !meta.fields.includes(column));

  if (missingColumns.length > 0) {
    console.error(
      `❌ ERROR: no se encontraron estas columnas en el CSV: ${missingColumns.join(", ")}\n` +
        `   Columnas detectadas: ${meta.fields.join(", ")}\n` +
        "   Ajustá las constantes de CSV_COLUMNS arriba de este archivo."
    );
    process.exit(1);
  }

  return data;
}

// ---------------------------------------------------------------------
// Matching
//
// Por carta, en dos pasadas:
//   1. Filtrar el CSV por club (clubsMatch) y buscar ahí primero
//      (exact_club / fuzzy_club, umbral laxo: el universo ya es chico).
//   2. Si el paso 1 no encontró nada, buscar en el CSV entero
//      (exact_global / fuzzy_global, umbral estricto + anclaje de
//      apellido vía tokenSubsetScore, porque acá el universo son ~18k
//      jugadores de cualquier liga).
// ---------------------------------------------------------------------

// Nombre exacto normalizado (contra long_name y/o short_name) dentro
// de un subconjunto de filas ya dado.
function findExactMatches(cardName, rows) {
  const target = normalize(cardName);
  if (!target) return [];
  return rows.filter((row) => {
    if (normalize(row[CSV_COLUMNS.fullName]) === target) return true;
    if (row[CSV_COLUMNS.shortName] && normalize(row[CSV_COLUMNS.shortName]) === target) return true;
    return false;
  });
}

// Candidatos cuyo nombre supera `threshold` de similaridad contra la
// carta (vía bestNameMatch, que ya compara contra long_name/short_name
// y se queda con el mejor de los dos).
function findFuzzyMatches(cardName, rows, threshold) {
  const scored = [];
  for (const row of rows) {
    const { score } = bestNameMatch(cardName, row);
    if (score >= threshold) scored.push({ row, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.row);
}

// Desempate por posición cuando queda más de un candidato: se prefiere
// el que comparte bucket de posición con la carta; si ninguno matchea,
// se queda con el primero (ya viene ordenado por score en el caso fuzzy).
function resolveTieByPosition(card, candidates) {
  if (candidates.length <= 1) return candidates[0] || null;
  const samePosition = candidates.filter((row) => positionMatches(card.position, row));
  return samePosition.length > 0 ? samePosition[0] : candidates[0];
}

// Paso 1: candidatos con club matcheado (ver clubsMatch).
function matchWithinClub(card, csvPlayers) {
  const clubCandidates = csvPlayers.filter((row) => clubsMatch(card.club, row[CSV_COLUMNS.club]));
  if (clubCandidates.length === 0) return null;

  const exactMatches = findExactMatches(card.name, clubCandidates);
  if (exactMatches.length > 0) {
    return { row: resolveTieByPosition(card, exactMatches), matchType: "exact_club" };
  }

  const fuzzyMatches = findFuzzyMatches(card.name, clubCandidates, CLUB_FUZZY_NAME_THRESHOLD);
  if (fuzzyMatches.length > 0) {
    return { row: resolveTieByPosition(card, fuzzyMatches), matchType: "fuzzy_club" };
  }

  return null;
}

// Paso 2 (fallback): CSV entero, sin filtro de club.
function matchGlobal(card, csvPlayers) {
  const exactMatches = findExactMatches(card.name, csvPlayers);
  if (exactMatches.length > 0) {
    return { row: resolveTieByPosition(card, exactMatches), matchType: "exact_global" };
  }

  const fuzzyMatches = findFuzzyMatches(card.name, csvPlayers, GLOBAL_FUZZY_NAME_THRESHOLD).filter(
    (row) => passesSurnameAnchor(card.name, row)
  );
  if (fuzzyMatches.length > 0) {
    return { row: resolveTieByPosition(card, fuzzyMatches), matchType: "fuzzy_global" };
  }

  return null;
}

function buildMatchResult(card, row, matchType) {
  const { value: matchedName } = bestNameMatch(card.name, row);
  const overallRaw = row[CSV_COLUMNS.overall];
  const futIdRaw = row[CSV_COLUMNS.futId];

  return {
    card_id: card.id,
    name: card.name,
    matched_name: matchedName,
    overall: overallRaw !== undefined && overallRaw !== "" ? Number(overallRaw) : null,
    fut_id_candidate: futIdRaw !== undefined && futIdRaw !== "" ? Number(futIdRaw) : null,
    match_type: matchType,
  };
}

async function fetchActiveCards() {
  const { data, error } = await supabase
    .from("cards")
    .select("id, name, club, position")
    .eq("is_active", true);

  if (error) {
    console.error("❌ Error leyendo cards de Supabase:", error.message);
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

async function run() {
  const csvPlayers = loadFc26Csv();
  const cards = await fetchActiveCards();

  console.log(`📦 ${cards.length} cartas activas en cards, ${csvPlayers.length} jugadores en el CSV de FC26.`);

  const matches = [];
  const unmatched = [];

  for (const card of cards) {
    const result = matchWithinClub(card, csvPlayers) || matchGlobal(card, csvPlayers);

    if (result) {
      matches.push(buildMatchResult(card, result.row, result.matchType));
    } else {
      unmatched.push({ card_id: card.id, name: card.name, club: card.club, position: card.position });
    }
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(MATCHES_PATH, JSON.stringify(matches, null, 2));
  fs.writeFileSync(UNMATCHED_PATH, JSON.stringify(unmatched, null, 2));

  const byType = {
    exact_club: matches.filter((m) => m.match_type === "exact_club"),
    fuzzy_club: matches.filter((m) => m.match_type === "fuzzy_club"),
    exact_global: matches.filter((m) => m.match_type === "exact_global"),
    fuzzy_global: matches.filter((m) => m.match_type === "fuzzy_global"),
  };

  console.log("\n📊 RESUMEN");
  console.log(`   Total cartas activas:  ${cards.length}`);
  console.log(`   exact_club:            ${byType.exact_club.length}`);
  console.log(`   fuzzy_club:            ${byType.fuzzy_club.length}`);
  console.log(`   exact_global:          ${byType.exact_global.length}`);
  console.log(`   fuzzy_global:          ${byType.fuzzy_global.length}`);
  console.log(`   Sin match:             ${unmatched.length}`);

  console.log(`\n💾 ${matches.length} match(es) escritos en ${MATCHES_PATH}`);
  console.log(`💾 ${unmatched.length} sin match escritos en ${UNMATCHED_PATH}`);

  for (const type of ["fuzzy_club", "fuzzy_global"]) {
    const sample = pickRandom(byType[type], FUZZY_SAMPLE_SIZE);
    console.log(`\n🔍 Muestra al azar de ${sample.length} match(es) "${type}" (revisar si el umbral está bien calibrado):`);
    for (const m of sample) {
      console.log(`   "${m.name}"  →  "${m.matched_name}"   (overall=${m.overall}, fut_id=${m.fut_id_candidate})`);
    }
  }
}

run();
