# Fase 1 — Escudos/banderas/liga (fetch-futgg-badges) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a migration + a Node script that resolves club badge, nation
flag and league logo per card from fut.gg (keyed by the already-known
`fut_id`), dedupes uploads by fut.gg's `eaId`, and stores the resulting
Supabase Storage URLs on `cards`.

**Architecture:** One SQL migration (`010_club_nation_league_badges.sql`)
adds 3 nullable text columns to `cards` and a public Storage bucket
(`team-badges`). One script (`scripts/fetch-futgg-badges.js`), structurally
identical to the existing `scripts/fetch-futgg-images.js`, iterates cards
that have `fut_id` but are missing any of the 3 new columns, calls
`fut.gg/api/fut/player-item-definitions/26/{fut_id}/`, and for each of
`club`/`nation`/`league` downloads the image once per unique `eaId`
(in-memory `Map` cache), re-encodes to WebP with `sharp`, uploads to
`team-badges/{kind}/{eaId}.webp`, and writes the 3 public URLs back onto
the card row.

**Tech Stack:** Node (ESM, `"type": "module"`), `@supabase/supabase-js`,
`sharp`, `dotenv`, global `fetch`. Same stack as the existing
`fetch-futgg-images.js`/`fetch-player-photos.js` scripts — no new
dependencies.

## Global Constraints

- Do not modify balancing constants (N/A here — this plan touches no
  gameplay balancing code). Per `CLAUDE.md`: run `node --check` on every
  script before considering a task done.
- Never hotlink fut.gg's CDN directly from the client — always mirror to
  the project's own Supabase Storage (established pattern, confirmed with
  the user).
- The script writes to the real Supabase project via
  `SUPABASE_SERVICE_KEY` (bypasses RLS). **Do not execute the script
  against the live database** — the user runs it themselves. Verification
  in this plan is limited to `node --check` (syntax) and static review of
  the request/response shapes already confirmed against the live fut.gg
  API during design.
- Never crash the whole run on a single card's failure — log and continue
  (established pattern in every existing `scripts/fetch-*.js`).

---

### Task 1: Migration — `club_badge_url` / `nation_flag_url` / `league_logo_url` + `team-badges` bucket

**Files:**
- Create: `migrations/010_club_nation_league_badges.sql`

**Interfaces:**
- Produces: `public.cards.club_badge_url` (text, nullable),
  `public.cards.nation_flag_url` (text, nullable),
  `public.cards.league_logo_url` (text, nullable), and the public Storage
  bucket `team-badges` — all consumed by Task 2.

- [ ] **Step 1: Write the migration file**

```sql
-- =====================================================================
-- 010_club_nation_league_badges.sql
-- Soporte para scripts/fetch-futgg-badges.js.
--
-- Agrega a `cards` las columnas para el escudo de club, la bandera de
-- país y el logo de liga (estilo carta EA FC Ultimate Team), resueltos
-- desde fut.gg por fut_id y resubidos a Storage propio (mismo patrón
-- que photo_url en 005_player_photos.sql). Crea el bucket público
-- team-badges donde viven esos archivos, deduplicados por eaId de
-- fut.gg (club/{eaId}.webp, nation/{eaId}.webp, league/{eaId}.webp) en
-- vez de uno por carta.
-- =====================================================================

begin;

alter table public.cards
  add column if not exists club_badge_url   text,
  add column if not exists nation_flag_url  text,
  add column if not exists league_logo_url  text;

-- Bucket público: los badges se sirven directo por URL pública, sin
-- pasar por una policy de storage.objects en cada lectura. Escritura
-- solo vía service_role (scripts/fetch-futgg-badges.js), mismo patrón
-- que el bucket player-photos en 005_player_photos.sql.
insert into storage.buckets (id, name, public)
values ('team-badges', 'team-badges', true)
on conflict (id) do nothing;

commit;
```

- [ ] **Step 2: Verify SQL syntax is well-formed**

There is no local Postgres instance to run this against. Sanity-check by
diffing structure against `migrations/005_player_photos.sql` (same
`alter table ... add column if not exists` + `insert into
storage.buckets ... on conflict do nothing` shape) — confirm every
statement ends in `;`, the file opens with `begin;` and closes with
`commit;`, exactly like every other file in `migrations/`.

- [ ] **Step 3: Commit**

```bash
git add migrations/010_club_nation_league_badges.sql
git commit -m "$(cat <<'EOF'
db: agregar club_badge_url/nation_flag_url/league_logo_url + bucket team-badges

Soporte para scripts/fetch-futgg-badges.js (Fase 1 del rediseño de
LineupScene): 3 columnas nuevas en cards y el bucket público donde
viven los escudos/banderas/logos deduplicados por eaId de fut.gg.
EOF
)"
```

---

### Task 2: Script — `scripts/fetch-futgg-badges.js`

**Files:**
- Create: `scripts/fetch-futgg-badges.js`

**Interfaces:**
- Consumes: `public.cards` columns `id`, `name`, `fut_id`,
  `club_badge_url`, `nation_flag_url`, `league_logo_url` (Task 1). Reads
  `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` from `.env` (same env vars as
  every other script in `scripts/`).
- Produces: updates `cards.club_badge_url` / `cards.nation_flag_url` /
  `cards.league_logo_url` for every processed card; uploads files to the
  `team-badges` bucket. No other file in this codebase imports this
  script — it is a standalone CLI entrypoint (`node
  scripts/fetch-futgg-badges.js [--limit N]`), same convention as
  `fetch-futgg-images.js`.

- [ ] **Step 1: Write the script**

```javascript
// scripts/fetch-futgg-badges.js
//
// Resuelve escudo de club, bandera de país y logo de liga (estilo carta
// EA FC Ultimate Team) para las cartas que ya tienen fut_id asignado
// (ver scripts/fetch-futgg-images.js, que es quien resuelve fut_id).
// Fuente: fut.gg/api/fut/player-item-definitions/26/{fut_id}/, el mismo
// dominio que ya usa fetch-futgg-images.js para la foto. La respuesta
// trae club/nation/league anidados, cada uno con un eaId estable y un
// imageUrl en el CDN de fut.gg (game-assets.fut.gg).
//
// A diferencia de fetch-futgg-images.js (que busca por nombre y
// desambigua por posición), acá no hay ambigüedad: se pide el detalle
// directo por fut_id.
//
// Dedup: club/nation/league se repiten en decenas de cartas (todos los
// jugadores de un mismo club, país o liga comparten el mismo eaId), así
// que se cachea en memoria durante la corrida y solo se descarga/sube
// un archivo por eaId, no uno por carta.
//
// Nunca corta el script entero por un jugador: si falla cualquier paso
// (fut_id sin match, imagen caída, error de Storage/DB), loguea el
// motivo y sigue con el siguiente sin tocar su fila.
//
// Uso:
//   node scripts/fetch-futgg-badges.js               # todas las pendientes
//   node scripts/fetch-futgg-badges.js --limit 10    # solo 10 (prueba)

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

const BUCKET = "team-badges";
const WEBP_QUALITY = 90;
const RATE_LIMIT_MS = 300;
const FUT_GG_DETAIL_URL = "https://www.fut.gg/api/fut/player-item-definitions/26";

// --limit N: procesa solo las primeras N cartas pendientes (para pruebas).
const LIMIT = (() => {
  const idx = process.argv.indexOf("--limit");
  if (idx === -1) return null;
  const value = Number(process.argv[idx + 1]);
  return Number.isFinite(value) && value > 0 ? value : null;
})();

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
    .select("id, name, fut_id, club_badge_url, nation_flag_url, league_logo_url")
    .not("fut_id", "is", null)
    .or("club_badge_url.is.null,nation_flag_url.is.null,league_logo_url.is.null");

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Error leyendo cards: ${error.message}`);
  return data || [];
}

async function fetchPlayerDetail(futId) {
  const response = await fetch(`${FUT_GG_DETAIL_URL}/${futId}/`);
  if (!response.ok) {
    throw new Error(`fut.gg respondió HTTP ${response.status}`);
  }
  const json = await response.json();
  return json?.data;
}

async function downloadImageBuffer(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function toWebp(rawBuffer) {
  return sharp(rawBuffer).webp({ quality: WEBP_QUALITY }).toBuffer();
}

// Sube (si hace falta) el badge de una entidad (club/nation/league) y
// devuelve su URL pública en Storage. badgeCache evita repetir la
// descarga+subida cuando varias cartas comparten el mismo eaId.
async function resolveBadgeUrl(badgeCache, kind, entity) {
  if (!entity?.eaId || !entity?.imageUrl) return null;

  const cacheKey = `${kind}/${entity.eaId}`;
  if (badgeCache.has(cacheKey)) return badgeCache.get(cacheKey);

  const rawBuffer = await downloadImageBuffer(entity.imageUrl);
  const webpBuffer = await toWebp(rawBuffer);

  const path = `${kind}/${entity.eaId}.webp`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, webpBuffer, { contentType: "image/webp", upsert: true });

  if (uploadError) {
    throw new Error(`Error subiendo ${cacheKey} a Storage: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  badgeCache.set(cacheKey, publicUrl);
  return publicUrl;
}

async function processCard(card, badgeCache) {
  const detail = await fetchPlayerDetail(card.fut_id);
  if (!detail) {
    throw new Error(`sin datos para fut_id=${card.fut_id}`);
  }

  const [clubBadgeUrl, nationFlagUrl, leagueLogoUrl] = await Promise.all([
    resolveBadgeUrl(badgeCache, "club", detail.club),
    resolveBadgeUrl(badgeCache, "nation", detail.nation),
    resolveBadgeUrl(badgeCache, "league", detail.league),
  ]);

  const { error: updateError } = await supabase
    .from("cards")
    .update({
      club_badge_url: clubBadgeUrl,
      nation_flag_url: nationFlagUrl,
      league_logo_url: leagueLogoUrl,
    })
    .eq("id", card.id);

  if (updateError) {
    throw new Error(`Error actualizando cards: ${updateError.message}`);
  }

  return { clubBadgeUrl, nationFlagUrl, leagueLogoUrl };
}

async function run() {
  await ensureBucketExists();

  const cards = await fetchPendingCards(LIMIT);
  console.log(`🛡️  Procesando ${cards.length} carta(s) pendiente(s)...\n`);

  const badgeCache = new Map();
  const stats = { procesados: 0, ok: 0, fallidas: 0 };
  const failures = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];

    try {
      await processCard(card, badgeCache);
      stats.ok += 1;
      console.log(`✅ ${card.name}`);
    } catch (err) {
      stats.fallidas += 1;
      failures.push({ name: card.name, reason: err.message });
      console.log(`❌ ${card.name}: ${err.message}`);
    }

    stats.procesados += 1;

    if (stats.procesados % 20 === 0) {
      console.log(`\n   ... ${stats.procesados}/${cards.length} procesados ...\n`);
    }

    if (i < cards.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  console.log("\n📊 RESUMEN");
  console.log(`   Procesados: ${stats.procesados}`);
  console.log(`   OK:         ${stats.ok}`);
  console.log(`   Fallidas:   ${stats.fallidas}`);
  console.log(`   Badges únicos subidos: ${badgeCache.size}`);

  if (failures.length > 0) {
    console.log("\n   Detalle de fallas:");
    for (const failure of failures) {
      console.log(`   - ${failure.name}: ${failure.reason}`);
    }
  }
}

run();
```

- [ ] **Step 2: Verify syntax**

Run: `node --check scripts/fetch-futgg-badges.js`
Expected: no output, exit code 0.

- [ ] **Step 3: Do NOT run the script against the live database**

Per Global Constraints, this script writes to the real Supabase project
with the service-role key. Leave execution to the user — they run:

```bash
node scripts/fetch-futgg-badges.js --limit 5
```

first to sanity-check a small batch, then without `--limit` for the full
run. Report the file as ready; do not invoke it yourself.

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch-futgg-badges.js
git commit -m "$(cat <<'EOF'
feat: script de enriquecimiento de escudo/bandera/liga desde fut.gg

Fase 1 del rediseño de LineupScene: para cartas con fut_id ya resuelto,
pide el detalle a fut.gg (player-item-definitions), sube club/nation/
league a Storage propio deduplicados por eaId, y guarda las 3 URLs en
cards. Mismo patrón de resiliencia que fetch-futgg-images.js.
EOF
)"
```
