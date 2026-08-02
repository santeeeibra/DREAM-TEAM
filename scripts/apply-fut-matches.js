// scripts/apply-fut-matches.js
//
// Aplica los matches de EA FC FUT (scripts/data/fut-matches.json) a la
// tabla `cards`: setea el overall (clampeado a RATING_FLOOR-RATING_CEILING)
// en las 6 stats, asigna el fut_id_candidate como `fut_id` (string) y
// marca `uses_generated_avatar = false`.
//
// Reglas:
//   1. Agrupa por `fut_id_candidate`. Si un mismo fut_id_candidate
//      aparece en más de un card_id (colisión), TODAS esas filas se
//      excluyen de la escritura y se guardan en
//      scripts/data/fut-conflicts.json para revisión manual.
//   2. NO toca `photo_url` ni nada relacionado a fotos.
//
// Por defecto corre en modo dry-run (solo imprime el preview). Para
// escribir de verdad en `cards`, correr con --apply:
//   node scripts/apply-fut-matches.js --apply

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { RATING_FLOOR, RATING_CEILING } from "./seed-players.js";

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

const MATCHES_PATH = path.join("scripts", "data", "fut-matches.json");
const CONFLICTS_PATH = path.join("scripts", "data", "fut-conflicts.json");
const APPLY = process.argv.includes("--apply");

// Jugadores conocidos para chequeo manual en el preview.
const WELL_KNOWN = [
  "van dijk", "haaland", "cole palmer", "isak", "gabriel fernando de jesus",
  "ødegaard", "declan rice", "alisson becker", "donnarumma", "florian wirtz",
  "phil foden", "bruno borges fernandes", "bukayo saka", "ollie watkins",
  "mbeumo", "saliba", "martinelli",
];

function normalize(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clampRating(value) {
  return Math.max(RATING_FLOOR, Math.min(RATING_CEILING, value));
}

async function run() {
  // -------------------------------------------------------------------
  // 1. Cargar el JSON y agrupar por fut_id_candidate, detectando colisiones.
  // -------------------------------------------------------------------
  const raw = JSON.parse(fs.readFileSync(MATCHES_PATH, "utf-8"));
  console.log(`📦 ${raw.length} filas en fut-matches.json.`);

  const byFutId = new Map(); // fut_id_candidate -> array de filas
  for (const row of raw) {
    const key = String(row.fut_id_candidate);
    if (!byFutId.has(key)) byFutId.set(key, []);
    byFutId.get(key).push(row);
  }

  // Colisión: un fut_id_candidate con más de un card_id distinto.
  const conflictedFutIds = new Set();
  for (const [futId, rows] of byFutId) {
    const distinctCardIds = new Set(rows.map((r) => r.card_id));
    if (distinctCardIds.size > 1) conflictedFutIds.add(futId);
  }

  const conflictedRows = raw.filter((r) => conflictedFutIds.has(String(r.fut_id_candidate)));
  const cleanRows = raw.filter((r) => !conflictedFutIds.has(String(r.fut_id_candidate)));

  if (conflictedRows.length > 0) {
    fs.writeFileSync(CONFLICTS_PATH, JSON.stringify(conflictedRows, null, 2));
    console.log(`⚠️  ${conflictedRows.length} fila(s) excluidas por conflicto de fut_id (guardadas en ${CONFLICTS_PATH}).`);
  } else {
    console.log("✅ Sin colisiones de fut_id.");
  }

  // -------------------------------------------------------------------
  // 2. Traer el overall_rating actual de cada card_id restante.
  // -------------------------------------------------------------------
  const cardIds = [...new Set(cleanRows.map((r) => r.card_id))];
  const { data: cards, error } = await supabase
    .from("cards")
    .select("id, name, overall_rating")
    .in("id", cardIds);

  if (error) {
    console.error("❌ Error leyendo de Supabase:", error.message);
    process.exit(1);
  }

  const currentByCard = new Map(cards.map((c) => [c.id, c.overall_rating]));

  // -------------------------------------------------------------------
  // 3. Armar el preview (antes → después) con el rating clampeado.
  // -------------------------------------------------------------------
  const preview = cleanRows.map((r) => {
    const before = currentByCard.get(r.card_id);
    const after = clampRating(r.overall);
    return {
      card_id: r.card_id,
      name: r.name,
      before,
      after,
      fut_id: String(r.fut_id_candidate),
      match_type: r.match_type,
    };
  });

  console.log("\n🔍 Jugadores conocidos (chequeo manual):");
  for (const needle of WELL_KNOWN) {
    const hit = preview.find((p) => normalize(p.name).includes(normalize(needle)));
    if (hit) {
      console.log(
        `   ${hit.name.padEnd(28)} ${hit.before} → ${hit.after}   fut_id=${hit.fut_id}  (${hit.match_type})`
      );
    }
  }

  console.log("\n🔍 Muestra adicional random (10):");
  const sampleSize = Math.min(10, preview.length);
  const shuffled = [...preview].sort(() => Math.random() - 0.5).slice(0, sampleSize);
  for (const p of shuffled) {
    console.log(`   ${p.name.padEnd(28)} ${p.before} → ${p.after}   fut_id=${p.fut_id}  (${p.match_type})`);
  }

  console.log("\n📊 RESUMEN");
  console.log(`   A actualizar:            ${preview.length}`);
  console.log(`   Excluidas por conflicto: ${conflictedRows.length}`);
  console.log(`   Total filas en JSON:     ${raw.length}`);

  if (!APPLY) {
    console.log("\n🧪 Dry-run (no se escribió nada). Correr con --apply para aplicar los cambios a cards.");
    return;
  }

  // -------------------------------------------------------------------
  // 4. Aplicar los cambios (solo con --apply).
  // -------------------------------------------------------------------
  console.log(`\n✏️  Aplicando ${preview.length} actualizaciones a cards...`);
  let updated = 0;
  let failed = 0;

  for (const p of preview) {
    const { error: updateError } = await supabase
      .from("cards")
      .update({
        pace: p.after,
        shooting: p.after,
        passing: p.after,
        defense: p.after,
        physical: p.after,
        goalkeeping: p.after,
        fut_id: p.fut_id,
        uses_generated_avatar: false,
      })
      .eq("id", p.card_id);

    if (updateError) {
      failed += 1;
      console.error(`❌ Falló ${p.name} (${p.card_id}):`, updateError.message);
    } else {
      updated += 1;
    }
  }

  console.log("\n📊 RESUMEN FINAL");
  console.log(`   Actualizadas: ${updated}`);
  console.log(`   Excluidas por conflicto: ${conflictedRows.length}`);
  if (failed > 0) {
    console.log(`   Fallidas:     ${failed}`);
  }
}

run();