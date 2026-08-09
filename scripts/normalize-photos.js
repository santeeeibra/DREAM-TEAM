/**
 * normalize-photos.js
 * Normaliza todas las fotos de jugadores al pipeline único:
 *   player-photos/futgg/{fut_id}.webp
 *
 * Scope: cartas cuya photo_url NO contiene '/futgg/'
 * Fuente primaria: https://futgg.com/player/image/?player_id={fut_id}
 * Fallback:        https://cdn.futbin.com/content/fifa26/img/players/{fut_id}.png
 *
 * Uso:
 *   node normalize-photos.js           → ejecuta normalización
 *   node normalize-photos.js --dry-run → muestra qué haría sin escribir nada
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, appendFileSync } from 'fs';
import { setTimeout as sleep } from 'timers/promises';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const RATE_LIMIT_MS = 1100;          // 1 req/seg a fuentes externas
const STORAGE_BUCKET = 'player-photos';
const STORAGE_PREFIX = 'futgg';
const PUBLIC_BASE = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${STORAGE_PREFIX}`;
const FAILED_LOG = 'failed_photos.json';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Intenta descargar la imagen de una fuente. Devuelve ArrayBuffer o null.
 */
async function fetchImage(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DreamTeam/1.0)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? '';
    // Rechazar respuestas que no sean imagen (ej: páginas HTML de error)
    if (!contentType.startsWith('image/')) return null;

    return { buffer: await res.arrayBuffer(), contentType };
  } catch {
    return null;
  }
}

/**
 * Descarga la foto de un jugador probando FUT.GG primero, luego FutBin.
 * Devuelve { buffer, contentType, source } o null si ambas fallan.
 */
async function downloadPlayerPhoto(futId) {
  const futggUrl = `https://futgg.com/player/image/?player_id=${futId}`;
  const futbinUrl = `https://cdn.futbin.com/content/fifa26/img/players/${futId}.png`;

  let result = await fetchImage(futggUrl);
  if (result) return { ...result, source: 'futgg' };

  result = await fetchImage(futbinUrl);
  if (result) return { ...result, source: 'futbin' };

  return null;
}

/**
 * Sube imagen a Supabase Storage. Devuelve la URL pública o null.
 */
async function uploadToStorage(futId, buffer, contentType) {
  const ext = contentType.includes('png') ? 'png' : 'webp';
  // Normalizamos siempre a .webp en la ruta aunque la fuente devuelva PNG
  const storagePath = `${STORAGE_PREFIX}/${futId}.webp`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error(`    ⚠️  Storage upload error (${futId}):`, error.message);
    return null;
  }

  return `${PUBLIC_BASE}/${futId}.webp`;
}

/**
 * Actualiza photo_url en la tabla cards.
 */
async function updateCardPhotoUrl(id, photoUrl) {
  const { error } = await supabase
    .from('cards')
    .update({ photo_url: photoUrl })
    .eq('id', id);

  if (error) {
    console.error(`    ⚠️  DB update error (${id}):`, error.message);
    return false;
  }
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔄  normalize-photos.js  ${DRY_RUN ? '[DRY RUN]' : ''}`);
  console.log('─'.repeat(55));

  // 1. Obtener cartas a procesar
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, fut_id, name, league_id, photo_url')
    .not('photo_url', 'like', '%/futgg/%');

  if (error) {
    console.error('❌  Error consultando cards:', error.message);
    process.exit(1);
  }

  console.log(`📋  Cartas a normalizar: ${cards.length}`);

  const byLeague = cards.reduce((acc, c) => {
    acc[c.league_id] = (acc[c.league_id] ?? 0) + 1;
    return acc;
  }, {});
  console.log('    Por liga:', byLeague);

  if (DRY_RUN) {
    console.log('\n🔍  DRY RUN — primeras 10 cartas que se procesarían:\n');
    cards.slice(0, 10).forEach(c =>
      console.log(`    [${c.league_id}] ${c.name} (fut_id: ${c.fut_id})\n      actual: ${c.photo_url}\n      → ${PUBLIC_BASE}/${c.fut_id}.webp`)
    );
    console.log('\n✅  Dry run finalizado. No se escribió nada.');
    return;
  }

  // 2. Procesar
  const failed = [];
  let ok = 0;

  // Inicializar log de errores vacío
  writeFileSync(FAILED_LOG, '[]');

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const { id, fut_id, name, league_id } = card;

    process.stdout.write(
      `[${String(i + 1).padStart(3)}/${cards.length}] ${league_id.padEnd(7)} ${name.substring(0, 28).padEnd(28)} (${fut_id}) → `
    );

    // Descargar imagen
    const img = await downloadPlayerPhoto(fut_id);

    if (!img) {
      process.stdout.write('❌  sin imagen\n');
      failed.push({ id, fut_id, name, league_id, reason: 'no_image' });
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    // Subir a Storage
    const newUrl = await uploadToStorage(fut_id, img.buffer, img.contentType);

    if (!newUrl) {
      process.stdout.write('❌  upload falló\n');
      failed.push({ id, fut_id, name, league_id, reason: 'upload_failed' });
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    // Actualizar DB
    const updated = await updateCardPhotoUrl(id, newUrl);

    if (!updated) {
      process.stdout.write('❌  db update falló\n');
      failed.push({ id, fut_id, name, league_id, reason: 'db_update_failed', newUrl });
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    process.stdout.write(`✅  [${img.source}]\n`);
    ok++;

    await sleep(RATE_LIMIT_MS);
  }

  // 3. Resumen
  console.log('\n' + '─'.repeat(55));
  console.log(`✅  Éxito:  ${ok}/${cards.length}`);
  console.log(`❌  Fallos: ${failed.length}`);

  if (failed.length > 0) {
    writeFileSync(FAILED_LOG, JSON.stringify(failed, null, 2));
    console.log(`📄  Fallos guardados en ${FAILED_LOG}`);

    const byReason = failed.reduce((acc, f) => {
      acc[f.reason] = (acc[f.reason] ?? 0) + 1;
      return acc;
    }, {});
    console.log('    Por motivo:', byReason);
  }

  console.log('');
}

main().catch(err => {
  console.error('❌  Error inesperado:', err);
  process.exit(1);
});
