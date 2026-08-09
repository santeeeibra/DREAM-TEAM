// scripts/fetch-escudoteca-badges.js
//
// Pobla clubs.logo_url para LaLiga y Premier League con los escudos reales
// de Escudoteca Paladar Negro (paladarnegro.net/escudoteca), en vez de los
// escudos genéricos de iniciales (generateClubBadgeDataURI) que hoy se ven
// en el selector de club del onboarding.
//
// paladarnegro.net está bloqueado por el proxy de egreso de red del sandbox
// donde se escribió este script, así que el scraping NUNCA se probó contra
// el HTML real — hay que correrlo desde una máquina con acceso normal a
// internet y revisar el resumen final (matcheados / sin matchear).
//
// Estrategia, en el mismo espíritu que scripts/fetch-futgg-badges.js:
//   1. Entra a la página índice del país (espana/inglaterra), busca el link
//      a la liga (LaLiga / Premier) y sigue a esa galería.
//   2. Junta todas las <img> de la galería que cuelguen de /escudoteca/,
//      resuelve la URL absoluta y arma un nombre candidato (alt/title, o el
//      texto del <a>/<td> que la envuelve, o el nombre del archivo).
//   3. Matchea cada club de la tabla `clubs` (liga=laliga|premier) contra
//      esos candidatos por nombre normalizado (sin tildes, sin mayúsculas,
//      sin puntuación). Si no matchea automático, se puede resolver a mano
//      con un override en escudoteca-overrides.json.
//   4. Descarga el PNG, lo sube a Storage (bucket "club-badges") y actualiza
//      clubs.logo_url + logo_source_url.
//
// Nunca corta el script entero por un club: si algo falla (link de liga no
// encontrado, club sin match, imagen caída, error de Storage/DB), loguea el
// motivo y sigue con el siguiente.
//
// Uso:
//   node scripts/fetch-escudoteca-badges.js                  # laliga + premier
//   node scripts/fetch-escudoteca-badges.js --liga=laliga    # solo una liga
//   node scripts/fetch-escudoteca-badges.js --dry-run        # solo matchea, no sube ni escribe nada
//
// Overrides manuales (para clubes que el auto-match no resuelve, o para
// pisar un match incorrecto): scripts/escudoteca-overrides.json
//   { "Deportivo Alavés": "https://paladarnegro.net/escudoteca/espana/primera/png/alaves.png" }
// Las claves son el `name` exacto tal cual está en la tabla `clubs`.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { JSDOM } from "jsdom";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const BUCKET = "club-badges";
const RATE_LIMIT_MS = 300;
const OVERRIDES_PATH = path.join(__dirname, "escudoteca-overrides.json");

const LIGAS = {
  laliga: {
    dbLeague: "laliga",
    indexUrl: "https://paladarnegro.net/escudoteca/espana/index.php",
    linkMatch: /laliga|primera\s*divisi[oó]n|\bprimera\b/i,
  },
  premier: {
    dbLeague: "premier",
    indexUrl: "https://paladarnegro.net/escudoteca/inglaterra/index.php",
    linkMatch: /premier/i,
  },
};

// --liga=laliga|premier: solo esa liga. Sin flag: las dos.
// --dry-run: matchea y loguea, no descarga/sube/escribe nada.
function parseArgs() {
  const args = process.argv.slice(2);
  const ligaArg = args.find((a) => a.startsWith("--liga="));
  const liga = ligaArg ? ligaArg.split("=")[1] : null;
  if (liga && !LIGAS[liga]) {
    console.error(`❌ --liga desconocida: "${liga}" (usar laliga|premier)`);
    process.exit(1);
  }
  return {
    ligas: liga ? [liga] : Object.keys(LIGAS),
    dryRun: args.includes("--dry-run"),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadOverrides() {
  if (!existsSync(OVERRIDES_PATH)) return {};
  try {
    return JSON.parse(readFileSync(OVERRIDES_PATH, "utf8"));
  } catch (err) {
    console.warn(`⚠️  No se pudo leer escudoteca-overrides.json: ${err.message}`);
    return {};
  }
}

// Normaliza para matchear: sin tildes, minúsculas, sin puntuación, espacios
// colapsados. "Deportivo Alavés" y "alaves" (nombre de archivo) matchean así.
function normalizar(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; dream-team-import/1.0)" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} en ${url}`);
  return response.text();
}

// Busca en la página índice del país el link a la galería de la liga
// (ej. "LaLiga" / "Primera División"). Si no encuentra ninguno, asume que
// la página índice YA es la galería (algunos escudotecas listan todo en una
// sola página) y la devuelve tal cual.
async function resolveGalleryUrl(indexUrl, linkMatch) {
  const html = await fetchHtml(indexUrl);
  const dom = new JSDOM(html, { url: indexUrl });
  const anchors = [...dom.window.document.querySelectorAll("a[href]")];
  const match = anchors.find((a) => linkMatch.test(a.textContent || ""));
  if (!match) {
    console.warn(`⚠️  No encontré link de liga en ${indexUrl}, uso la página índice directo.`);
    return indexUrl;
  }
  return new URL(match.getAttribute("href"), indexUrl).href;
}

// Junta todas las <img> de la galería que cuelguen de /escudoteca/, con un
// nombre candidato sacado de alt/title, o si no hay, del <a>/<td> que la
// envuelve, o si no hay nada de texto, del nombre de archivo.
function extractCandidates(html, pageUrl) {
  const dom = new JSDOM(html, { url: pageUrl });
  const imgs = [...dom.window.document.querySelectorAll("img")];
  const candidatos = [];
  for (const img of imgs) {
    const src = img.getAttribute("src");
    if (!src) continue;
    let abs;
    try {
      abs = new URL(src, pageUrl).href;
    } catch {
      continue;
    }
    if (!/\/escudoteca\//i.test(abs)) continue;
    if (!/\.(png|gif|jpg|jpeg)$/i.test(abs)) continue;

    let nombre = img.getAttribute("alt") || img.getAttribute("title") || "";
    if (!nombre) {
      const contenedor = img.closest("a, td, li, figure");
      nombre = contenedor?.getAttribute("title") || contenedor?.textContent?.trim() || "";
    }
    if (!nombre) {
      nombre = decodeURIComponent(abs.split("/").pop()).replace(/\.(png|gif|jpg|jpeg)$/i, "");
    }
    candidatos.push({ url: abs, nombre, nombreNorm: normalizar(nombre) });
  }
  return candidatos;
}

// Matchea un club de la DB contra los candidatos scrapeados: exacto primero,
// después "uno incluye al otro" (cubre "Athletic Club" vs "athletic bilbao"
// o "atletico" vs "atletico de madrid").
function matchClub(clubNombreNorm, candidatos) {
  const exacto = candidatos.find((c) => c.nombreNorm === clubNombreNorm);
  if (exacto) return exacto;
  const parcial = candidatos.find(
    (c) => c.nombreNorm.includes(clubNombreNorm) || clubNombreNorm.includes(c.nombreNorm)
  );
  return parcial || null;
}

async function ensureBucketExists() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`No se pudo listar buckets de Storage: ${listError.message}`);
  if (buckets.some((b) => b.name === BUCKET)) return;

  console.log(`🪣 Bucket "${BUCKET}" no existe, creándolo como público...`);
  const { error: createError } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (createError) throw new Error(`No se pudo crear el bucket "${BUCKET}": ${createError.message}`);
}

async function fetchImageBuffer(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; dream-team-import/1.0)" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "image/png";
  return { buffer: Buffer.from(await response.arrayBuffer()), contentType };
}

async function procesarLiga(ligaKey, { dryRun, overrides, stats }) {
  const cfg = LIGAS[ligaKey];
  console.log(`\n🔎 ${ligaKey}: resolviendo galería desde ${cfg.indexUrl}`);

  const { data: clubs, error } = await supabase
    .from("clubs")
    .select("id, name, logo_url")
    .eq("league", cfg.dbLeague)
    .order("name");
  if (error) throw new Error(`Error leyendo clubs (${ligaKey}): ${error.message}`);

  let candidatos = [];
  try {
    const galleryUrl = await resolveGalleryUrl(cfg.indexUrl, cfg.linkMatch);
    console.log(`   Galería: ${galleryUrl}`);
    const html = await fetchHtml(galleryUrl);
    candidatos = extractCandidates(html, galleryUrl);
    console.log(`   ${candidatos.length} imagen(es) candidatas encontradas.`);
  } catch (err) {
    console.error(`❌ No se pudo scrapear la galería de ${ligaKey}: ${err.message}`);
    console.error(`   Se sigue solo con overrides manuales para esta liga.`);
  }

  for (const club of clubs) {
    stats.total += 1;
    const overrideUrl = overrides[club.name];
    const match = overrideUrl ? { url: overrideUrl, nombre: club.name } : matchClub(normalizar(club.name), candidatos);

    if (!match) {
      stats.sinMatch.push(club.name);
      console.log(`❔ ${club.name}: sin match automático (agregalo a escudoteca-overrides.json)`);
      continue;
    }

    console.log(`${overrideUrl ? "🔧" : "✅"} ${club.name} → ${match.url}${overrideUrl ? " (override)" : ` (matcheado con "${match.nombre}")`}`);

    if (dryRun) {
      stats.matcheados += 1;
      continue;
    }

    try {
      const { buffer, contentType } = await fetchImageBuffer(match.url);
      const ext = contentType.includes("gif") ? "gif" : contentType.includes("jpeg") ? "jpg" : "png";
      const storagePath = `${cfg.dbLeague}/${club.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, { contentType, upsert: true });
      if (uploadError) throw new Error(`Storage: ${uploadError.message}`);

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

      const { error: updateError } = await supabase
        .from("clubs")
        .update({ logo_url: publicUrl, logo_source_url: match.url })
        .eq("id", club.id);
      if (updateError) throw new Error(`DB: ${updateError.message}`);

      stats.matcheados += 1;
      stats.subidos += 1;
    } catch (err) {
      stats.fallidos.push({ club: club.name, motivo: err.message });
      console.log(`❌ ${club.name}: ${err.message}`);
    }

    await sleep(RATE_LIMIT_MS);
  }
}

async function run() {
  const { ligas, dryRun } = parseArgs();
  const overrides = loadOverrides();

  console.log(`🛡️  Escudoteca → clubs.logo_url (${ligas.join(", ")})${dryRun ? " [dry-run]" : ""}`);
  if (Object.keys(overrides).length > 0) {
    console.log(`   ${Object.keys(overrides).length} override(s) manual(es) cargado(s) de escudoteca-overrides.json`);
  }

  if (!dryRun) await ensureBucketExists();

  const stats = { total: 0, matcheados: 0, subidos: 0, sinMatch: [], fallidos: [] };

  for (const ligaKey of ligas) {
    try {
      await procesarLiga(ligaKey, { dryRun, overrides, stats });
    } catch (err) {
      console.error(`❌ Falló la liga "${ligaKey}" entera: ${err.message}`);
    }
  }

  console.log("\n📊 RESUMEN");
  console.log(`   Clubes totales:     ${stats.total}`);
  console.log(`   Matcheados:         ${stats.matcheados}`);
  if (!dryRun) console.log(`   Subidos a Storage:  ${stats.subidos}`);
  console.log(`   Sin match:          ${stats.sinMatch.length}`);
  if (stats.sinMatch.length > 0) {
    console.log(`     - ${stats.sinMatch.join("\n     - ")}`);
  }
  if (stats.fallidos.length > 0) {
    console.log(`   Fallidos: ${stats.fallidos.length}`);
    for (const f of stats.fallidos) console.log(`     - ${f.club}: ${f.motivo}`);
  }
}

run();
