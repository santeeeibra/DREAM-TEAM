// scripts/ingest-fpl.js
//
// Descarga el bootstrap-static de la Fantasy Premier League (pública,
// sin API key) y vuelca cada jugador en staging_players. No toca la
// tabla `cards` en ningún momento: eso lo hace un humano, vía la cola
// de revisión que llena scripts/reconcile.js.

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

const FPL_BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/";
const SOURCE = "fpl";
const BATCH_SIZE = 200;

// element_type de FPL: 1 = arquero, 2 = defensor, 3 = mediocampista,
// 4 = delantero. Se mapea a las mismas siglas que usa cards.position
// para que la revisión/aprobación futura sea directa.
const ELEMENT_TYPE_TO_POSITION = {
  1: "POR",
  2: "DEF",
  3: "MED",
  4: "DEL",
};

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function ingest() {
  console.log(`⚽ Descargando ${FPL_BOOTSTRAP_URL} ...`);
  const response = await fetch(FPL_BOOTSTRAP_URL);

  if (!response.ok) {
    console.error(`❌ La API de FPL respondió ${response.status} ${response.statusText}`);
    process.exit(1);
  }

  const data = await response.json();
  const teams = data.teams || [];
  const elements = data.elements || [];

  const clubById = new Map(teams.map((team) => [team.id, team.name]));

  console.log(`📦 ${elements.length} jugadores / ${teams.length} clubes recibidos de FPL.`);

  const rows = elements.map((el) => ({
    source: SOURCE,
    external_id: String(el.id),
    name: `${el.first_name} ${el.second_name}`.trim(),
    club: clubById.get(el.team) || null,
    position: ELEMENT_TYPE_TO_POSITION[el.element_type] || null,
    raw_data: el,
    fetched_at: new Date().toISOString(),
  }));

  let upserted = 0;
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const { error, count } = await supabase
      .from("staging_players")
      .upsert(batch, { onConflict: "source,external_id", count: "exact" });

    if (error) {
      console.error("❌ Error al insertar en staging_players:", error.message);
      process.exit(1);
    }

    upserted += count ?? batch.length;
    console.log(`   ${upserted}/${rows.length} jugadores procesados...`);
  }

  console.log(`✅ Listo. ${rows.length} jugadores de FPL volcados en staging_players (source='fpl').`);
}

ingest();
