// scripts/fetch-player-photos.js
//
// Descarga las fotos oficiales de jugadores de Premier League (usando
// el número de foto que trae staging_players.raw_data desde FPL) y las
// sube a Supabase Storage. Cruza `cards` con `staging_players` por
// nombre exacto: hoy ese join es 1:1 para las 564 filas de ambas tablas
// (ver 002_staging.sql / scripts/ingest-fpl.js), así que no hace falta
// fuzzy matching.
//
// Nunca corta el script entero por un jugador: si falla cualquier paso
// (sin match en staging, sin foto en raw_data, 404 al descargar, error
// de Storage/DB), loguea el motivo y sigue con el siguiente sin tocar
// su fila.

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
const CONCURRENCY = 8;
const PHOTO_CREDIT = "Premier League";

// El CDN de la Premier League no tiene el recorte 250x250 cacheado para
// todos los jugadores (da 403 aunque el jugador exista y tenga foto en
// tamaños menores: confirmado a mano con Andrew Robertson, entre otros).
// Se prueba de mayor a menor calidad y se toma la primera que responda
// 200; sharp igual nunca upscalea (fit: "inside" + withoutEnlargement),
// así que una foto más chica sale nítida en vez de pixelada.
const PHOTO_SIZES = ["250x250", "110x140", "40x40"];

function photoUrlFor(photoNumber, size) {
  return `https://resources.premierleague.com/premierleague/photos/players/${size}/p${photoNumber}.png`;
}

// raw_data.photo llega como "154561.jpg"; el número es el mismo id que
// usa el CDN de la Premier League para servir la foto en distintos tamaños.
function extractPhotoNumber(rawPhoto) {
  const match = /^(\d+)\./.exec(rawPhoto || "");
  return match ? match[1] : null;
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

async function downloadImageBuffer(imageUrl) {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

// Prueba cada tamaño de PHOTO_SIZES hasta que uno responda 200.
async function downloadBestAvailablePhoto(photoNumber) {
  const httpErrors = [];

  for (const size of PHOTO_SIZES) {
    const sourceUrl = photoUrlFor(photoNumber, size);
    try {
      const buffer = await downloadImageBuffer(sourceUrl);
      return { buffer, sourceUrl };
    } catch (err) {
      httpErrors.push(`${size}: ${err.message}`);
    }
  }

  throw new Error(`sin foto disponible en ningún tamaño (${httpErrors.join(", ")})`);
}

async function toWebp(rawBuffer) {
  return sharp(rawBuffer)
    .resize(TARGET_SIZE, TARGET_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

async function uploadPhoto(cardId, webpBuffer) {
  const path = `${cardId}.webp`;

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

async function processCard(card, stagingByName) {
  const staged = stagingByName.get(card.name);
  if (!staged) throw new Error("sin match en staging_players (nombre no encontrado)");

  const rawPhoto = staged.raw_data?.photo;
  const photoNumber = extractPhotoNumber(rawPhoto);
  if (!photoNumber) {
    throw new Error(`raw_data.photo ausente o con formato inesperado ("${rawPhoto ?? ""}")`);
  }

  const { buffer: rawBuffer, sourceUrl } = await downloadBestAvailablePhoto(photoNumber);
  const webpBuffer = await toWebp(rawBuffer);
  const publicUrl = await uploadPhoto(card.id, webpBuffer);

  const { error: updateError } = await supabase
    .from("cards")
    .update({
      photo_url: publicUrl,
      photo_credit: PHOTO_CREDIT,
      photo_source_url: sourceUrl,
      uses_generated_avatar: false,
    })
    .eq("id", card.id);

  if (updateError) {
    throw new Error(`Error actualizando cards: ${updateError.message}`);
  }
}

// Pool simple de concurrencia: dispara hasta CONCURRENCY tareas en
// paralelo y va reemplazando cada una que termina, sin más dependencias.
async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runNext() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
  return results;
}

async function fetchAllCards() {
  const pageSize = 1000;
  let allCards = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("cards")
      .select("id, name")
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Error leyendo cards: ${error.message}`);
    allCards = allCards.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allCards;
}

async function fetchAllStagingPlayers() {
  const pageSize = 1000;
  let all = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("staging_players")
      .select("name, raw_data")
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Error leyendo staging_players: ${error.message}`);
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function fetchPlayerPhotos() {
  await ensureBucketExists();

  const [cards, stagingPlayers] = await Promise.all([
    fetchAllCards(),
    fetchAllStagingPlayers(),
  ]);

  const stagingByName = new Map(stagingPlayers.map((row) => [row.name, row]));

  console.log(`📸 Procesando ${cards.length} carta(s)...\n`);

  const failures = [];
  let ok = 0;

  await runWithConcurrency(cards, CONCURRENCY, async (card) => {
    try {
      await processCard(card, stagingByName);
      ok += 1;
      console.log(`✅ ${card.name}`);
    } catch (err) {
      failures.push({ name: card.name, reason: err.message });
      console.log(`❌ ${card.name}: ${err.message}`);
    }
  });

  console.log("\n📊 RESUMEN");
  console.log(`   OK:      ${ok}/${cards.length}`);
  console.log(`   Fallidas: ${failures.length}/${cards.length}`);

  if (failures.length > 0) {
    console.log("\n   Detalle de fallas:");
    for (const failure of failures) {
      console.log(`   - ${failure.name}: ${failure.reason}`);
    }
  }
}

fetchPlayerPhotos();
