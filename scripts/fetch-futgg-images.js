// scripts/fetch-futgg-images.js
//
// Descarga las imágenes oficiales de EA FC FUT desde fut.gg para las
// cartas que todavía usan avatar generado (uses_generated_avatar = true
// o photo_url null) y las sube a Supabase Storage (bucket player-photos,
// ruta futgg/{card_id}.webp). Mismo patrón que fetch-player-photos.js:
// nunca corta el script entero por un jugador, loguea el motivo y sigue.
//
// Flujo por carta:
//   1. Busca en la API global-search de fut.gg con el nombre del jugador.
//   2. Filtra data.groups[0].results por meta.isDynamic === false (la
//      carta base, no las versiones dinámicas/IF/TOTY).
//   3. Si hay más de un resultado base (nombres ambiguos), desambigua
//      comparando meta.position (siglas FUT) contra cards.position
//      (POR/DEF/MED/DEL). Si sigue empatado, loguea "revisar a mano" y
//      saltea sin romper el loop.
//   4. Si hay match único: descarga meta.imageUrl, convierte a WebP
//      calidad 80 max 250x250 con sharp, sube a Supabase Storage y
//      actualiza cards (photo_url, uses_generated_avatar = false,
//      fut_id = meta.basePlayerEaId).
//
// Rate-limit: ~300ms entre requests a fut.gg para no gatillar bloqueos.
// Progreso cada 20 jugadores y resumen final (procesados, matcheados,
// ambiguos, sin resultado, fallidos).
//
// Uso:
//   node scripts/fetch-futgg-images.js                # todos los pendientes
//   node scripts/fetch-futgg-images.js --limit 10     # solo 10 (prueba)

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

const BUCKET = "player-photos";
const TARGET_SIZE = 250;
const WEBP_QUALITY = 80;
const RATE_LIMIT_MS = 300;
const FUT_GG_SEARCH_URL = "https://www.fut.gg/api/fut/global-search/";

// --limit N: procesa solo las primeras N cartas pendientes (para pruebas).
const LIMIT = (() => {
  const idx = process.argv.indexOf("--limit");
  if (idx === -1) return null;
  const value = Number(process.argv[idx + 1]);
  return Number.isFinite(value) && value > 0 ? value : null;
})();

// Mapeo de posiciones de FUT (meta.position) a la categoría de cards
// (POR/DEF/MED/DEL). FUT usa siglas específicas por puesto; cards usa
// las 4 categorías de FPL.
const FUT_POSITION_TO_CARD_POSITION = {
  GK: "POR",
  CB: "DEF",
  LB: "DEF",
  RB: "DEF",
  LWB: "DEF",
  RWB: "DEF",
  CDM: "MED",
  CM: "MED",
  CAM: "MED",
  LM: "MED",
  RM: "MED",
  LW: "MED",
  RW: "MED",
  ST: "DEL",
  CF: "DEL",
};

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
    .select("id, name, position")
    .or("uses_generated_avatar.eq.true,photo_url.is.null");

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Error leyendo cards: ${error.message}`);
  return data || [];
}

// Llama a la API de fut.gg y devuelve data.groups[0].results (o []).
async function searchFutGg(name) {
  const url = `${FUT_GG_SEARCH_URL}?q=${encodeURIComponent(name)}&include_expired=false`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`fut.gg respondió HTTP ${response.status}`);
  }

  const json = await response.json();
  return json?.data?.groups?.[0]?.results || [];
}

// Filtra la carta base (isDynamic === false) y desambigua por posición.
// Devuelve { match, reason } donde reason es "ok" | "sin_resultado" |
// "ambiguo" | "revisar_mano".
function findBaseCard(results, card) {
  const baseCards = results.filter((r) => r.meta?.isDynamic === false);

  if (baseCards.length === 0) {
    return { match: null, reason: "sin_resultado" };
  }

  if (baseCards.length === 1) {
    return { match: baseCards[0], reason: "ok" };
  }

  // Más de una carta base: desambiguar por posición.
  const cardPosition = card.position;
  const byPosition = baseCards.filter((r) => {
    const futPosition = r.meta?.position;
    const mapped = FUT_POSITION_TO_CARD_POSITION[futPosition];
    return mapped === cardPosition;
  });

  if (byPosition.length === 1) {
    return { match: byPosition[0], reason: "ok" };
  }

  // Sigue ambiguo (0 o >1 tras filtrar por posición) → revisar a mano.
  return { match: null, reason: "revisar_mano" };
}

async function downloadImageBuffer(imageUrl) {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

// Misma función de sharp que fetch-player-photos.js: resize 250x250
// fit inside + withoutEnlargement, WebP calidad 80.
async function toWebp(rawBuffer) {
  return sharp(rawBuffer)
    .resize(TARGET_SIZE, TARGET_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

async function uploadPhoto(cardId, webpBuffer) {
  const path = `futgg/${cardId}.webp`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, webpBuffer, { contentType: "image/webp", upsert: true });

  if (uploadError) {
    throw new Error(`Error subiendo a Storage: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return publicUrl;
}

async function processCard(card) {
  const results = await searchFutGg(card.name);
  const { match, reason } = findBaseCard(results, card);

  if (reason === "sin_resultado") {
    return { status: "sin_resultado", detail: "sin carta base (isDynamic=false)" };
  }

  if (reason === "revisar_mano") {
    const positions = results
      .filter((r) => r.meta?.isDynamic === false)
      .map((r) => `${r.meta?.position} (${r.meta?.basePlayerEaId})`)
      .join(", ");
    return {
      status: "revisar_mano",
      reason: `ambiguo: ${positions} — revisar a mano`,
    };
  }

  // Match único.
  const meta = match.meta;
  const rawBuffer = await downloadImageBuffer(meta.imageUrl);
  const webpBuffer = await toWebp(rawBuffer);
  const publicUrl = await uploadPhoto(card.id, webpBuffer);

  const { error: updateError } = await supabase
    .from("cards")
    .update({
      photo_url: publicUrl,
      uses_generated_avatar: false,
      fut_id: String(meta.basePlayerEaId),
    })
    .eq("id", card.id);

  if (updateError) {
    throw new Error(`Error actualizando cards: ${updateError.message}`);
  }

  return {
    status: "ok",
    futId: String(meta.basePlayerEaId),
    position: meta.position,
  };
}

async function run() {
  await ensureBucketExists();

  const cards = await fetchPendingCards(LIMIT);
  console.log(`📸 Procesando ${cards.length} carta(s) pendiente(s)...\n`);

  const stats = {
    procesados: 0,
    ok: 0,
    ambiguos: 0,
    sin_resultado: 0,
    fallidos: 0,
  };
  const failures = [];
  const ambiguous = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];

    try {
      const result = await processCard(card);

      if (result.status === "ok") {
        stats.ok += 1;
        console.log(`✅ ${card.name} (${card.position}) → fut_id=${result.futId}`);
      } else if (result.status === "revisar_mano") {
        stats.ambiguos += 1;
        ambiguous.push({ name: card.name, reason: result.reason });
        console.log(`⚠️  ${card.name} (${card.position}): ${result.reason}`);
      } else {
        stats.sin_resultado += 1;
        console.log(`🔍 ${card.name} (${card.position}): ${result.detail}`);
      }
    } catch (err) {
      stats.fallidos += 1;
      failures.push({ name: card.name, reason: err.message });
      console.log(`❌ ${card.name} (${card.position}): ${err.message}`);
    }

    stats.procesados += 1;

    // Progreso cada 20 jugadores.
    if (stats.procesados % 20 === 0) {
      console.log(`\n   ... ${stats.procesados}/${cards.length} procesados ...\n`);
    }

    // Rate-limit entre requests a fut.gg (no aplica al último).
    if (i < cards.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  console.log("\n📊 RESUMEN FINAL");
  console.log(`   Procesados:    ${stats.procesados}`);
  console.log(`   Matcheados:    ${stats.ok}`);
  console.log(`   Ambiguos:      ${stats.ambiguos}`);
  console.log(`   Sin resultado: ${stats.sin_resultado}`);
  console.log(`   Fallidos:      ${stats.fallidos}`);

  if (ambiguous.length > 0) {
    console.log("\n   ⚠️  Revisar a mano:");
    for (const a of ambiguous) {
      console.log(`   - ${a.name}: ${a.reason}`);
    }
  }

  if (failures.length > 0) {
    console.log("\n   ❌ Detalle de fallas:");
    for (const f of failures) {
      console.log(`   - ${f.name}: ${f.reason}`);
    }
  }
}

run();