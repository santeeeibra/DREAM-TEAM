// scripts/sync-futgg-names.js
//
// Actualiza la columna `name` de `cards` con el nombre corto real de fut.gg
// (el que se imprime en la carta del juego, ej. "Ødegaard", "McGinn",
// "Lewis-Skelly"), usando el fut_id ya guardado (= basePlayerEaId de EA).
//
// Test manual previo (ver resultado logueado más abajo con --test):
//   - El slug de /players/{fut_id}-{slug}/ es arbitrario, no afecta el resolve.
//   - El <h1> de la página es el nombre completo (commonName), NO el nombre
//     corto: para jugadores no-superestrella difiere del nombre impreso en
//     la carta (ej. h1 "Martin Ødegaard" vs impreso "Ødegaard").
//   - El nombre corto real está en el campo `cardName` embebido en el HTML
//     (payload de Next.js/RSC), no en el DOM visible. Se extrae con regex.
//
// Flujo por carta:
//   1. GET a https://www.fut.gg/players/${fut_id}-x/
//   2. Si 404 o no se encuentra `cardName` en el HTML: "no encontrado", no se toca la fila.
//   3. Si el nombre nuevo difiere del actual: loguea "ANTES -> DESPUÉS" y
//      (solo con --write) hace UPDATE cards SET name = nuevo WHERE id = id.
//
// Uso:
//   node scripts/sync-futgg-names.js --test              # prueba de resolución de un solo fut_id conocido
//   node scripts/sync-futgg-names.js --limit=10           # dry-run, no escribe
//   node scripts/sync-futgg-names.js --limit=10 --write   # escribe de verdad

import dotenv from "dotenv";
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

const RATE_LIMIT_MS = 400;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function playerUrl(futId) {
  return `https://www.fut.gg/players/${futId}-x/`;
}

// Extrae el primer cardName:"..." del payload embebido en el HTML.
// Todas las versiones/rarezas de un mismo jugador comparten el mismo
// nombre corto, así que el primer match alcanza.
function extractCardName(html) {
  const match = html.match(/cardName:"((?:[^"\\]|\\.)*)"/);
  if (!match) return null;

  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Devuelve { status: "ok", name } | { status: "no_encontrado", reason }
async function resolveShortName(futId) {
  const response = await fetch(playerUrl(futId), {
    headers: { "User-Agent": USER_AGENT },
  });

  if (response.status === 404) {
    return { status: "no_encontrado", reason: "HTTP 404" };
  }

  if (!response.ok) {
    return { status: "no_encontrado", reason: `HTTP ${response.status}` };
  }

  const html = await response.text();
  const cardName = extractCardName(html);

  if (!cardName) {
    return { status: "no_encontrado", reason: "no se encontró cardName en el HTML" };
  }

  return { status: "ok", name: cardName };
}

async function runTest() {
  // fut_id conocido (Myles Lewis-Skelly) usado para validar el comportamiento
  // del slug arbitrario y la extracción de cardName antes de correr el batch.
  const TEST_FUT_ID = "278773";

  console.log(`🧪 Test manual con fut_id=${TEST_FUT_ID}\n`);

  for (const slug of ["x", "cualquier-slug-invalido", ""]) {
    const url = slug ? `https://www.fut.gg/players/${TEST_FUT_ID}-${slug}/` : `https://www.fut.gg/players/${TEST_FUT_ID}/`;
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    console.log(`   GET ${url} -> ${response.status}`);
    await sleep(RATE_LIMIT_MS);
  }

  const result = await resolveShortName(TEST_FUT_ID);
  console.log(`\n   Resultado resolveShortName(${TEST_FUT_ID}):`, result);
  console.log(
    "\n   Conclusión: el slug es arbitrario (no afecta el resolve); el nombre"
  );
  console.log(
    "   corto se extrae del campo `cardName` embebido en el HTML, no del <h1>."
  );
}

// --limit=N
const LIMIT = (() => {
  const arg = process.argv.find((a) => a.startsWith("--limit="));
  if (!arg) return null;
  const value = Number(arg.split("=")[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
})();

const WRITE = process.argv.includes("--write");
const TEST = process.argv.includes("--test");

async function fetchCardsWithFutId(limit) {
  let query = supabase
    .from("cards")
    .select("id, fut_id, name")
    .not("fut_id", "is", null);

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Error leyendo cards: ${error.message}`);
  return data || [];
}

async function updateCardName(id, name) {
  const { error } = await supabase.from("cards").update({ name }).eq("id", id);
  if (error) throw new Error(`Error actualizando cards: ${error.message}`);
}

async function run() {
  if (TEST) {
    await runTest();
    return;
  }

  console.log(
    `Modo: ${WRITE ? "⚠️  ESCRITURA (--write)" : "🧪 DRY-RUN (sin --write, no se escribe nada)"}\n`
  );

  const cards = await fetchCardsWithFutId(LIMIT);
  console.log(`Procesando ${cards.length} carta(s) con fut_id...\n`);

  const stats = {
    procesados: 0,
    actualizados: 0,
    no_encontrados: 0,
    sin_cambios: 0,
  };
  const notFound = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];

    try {
      const result = await resolveShortName(card.fut_id);

      if (result.status === "no_encontrado") {
        stats.no_encontrados += 1;
        notFound.push({ id: card.id, futId: card.fut_id, reason: result.reason });
        console.log(`🔍 fut_id=${card.fut_id} (${card.name}): no encontrado (${result.reason})`);
      } else if (result.name === card.name) {
        stats.sin_cambios += 1;
        console.log(`= fut_id=${card.fut_id}: "${card.name}" sin cambios`);
      } else {
        stats.actualizados += 1;
        console.log(`✏️  fut_id=${card.fut_id}: "${card.name}" -> "${result.name}"`);

        if (WRITE) {
          await updateCardName(card.id, result.name);
        }
      }
    } catch (err) {
      stats.no_encontrados += 1;
      notFound.push({ id: card.id, futId: card.fut_id, reason: err.message });
      console.log(`❌ fut_id=${card.fut_id} (${card.name}): ${err.message}`);
    }

    stats.procesados += 1;

    if (i < cards.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  console.log("\n📊 RESUMEN FINAL");
  console.log(`   Procesados:    ${stats.procesados}`);
  console.log(`   Actualizados:  ${stats.actualizados}${WRITE ? "" : " (dry-run, no escrito)"}`);
  console.log(`   No encontrados:${stats.no_encontrados}`);
  console.log(`   Sin cambios:   ${stats.sin_cambios}`);

  if (notFound.length > 0) {
    console.log("\n   🔍 No encontrados:");
    for (const f of notFound) {
      console.log(`   - fut_id=${f.futId} (id=${f.id}): ${f.reason}`);
    }
  }

  if (!WRITE && stats.actualizados > 0) {
    console.log("\n   ℹ️  Este fue un dry-run. Corré con --write para aplicar los cambios.");
  }
}

run();
