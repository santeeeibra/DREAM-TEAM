// scripts/check-manager-schema.js
//
// Verifica que la tabla `managers` tenga las columnas que usan
// getManagerParaTemporada (id, money, current_season) y el perfil
// extendido del DT (league_id, club_id, reputation) y reporta el estado
// real de la base. Sirve tanto para diagnosticar el error
// "column managers.reputation does not exist" / "Could not find the
// 'club_id' column of 'managers' in the schema cache" como para
// confirmar que la migración 011 quedó aplicada.
//
// Uso:
//   node scripts/check-manager-schema.js

import dotenv from "dotenv";
import { pathToFileURL } from "url";
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

// Columnas del perfil extendido que exige la migración 011.
const PROFILE_COLUMNS = ["league_id", "club_id", "reputation"];

// Prueba una columna puntual y devuelve true si existe (la consulta
// responde sin error de PostgREST), false si no existe.
async function columnExiste(columna) {
  const { error } = await supabase.from("managers").select(columna).limit(1);
  return !error;
}

async function run() {
  console.log("🔎 Consultando managers con las columnas de temporada …");

  const { data, error } = await supabase
    .from("managers")
    .select("id, money, current_season");

  if (error) {
    console.error("❌ La consulta falló:", error.message);
    console.error("\n   Esto significa que la migración 011 NO está aplicada.");
    console.error("   Aplicá migrations/011_manager_profile_ids.sql en el");
    console.error("   SQL Editor del dashboard de Supabase y volvé a correr este script.\n");
    process.exit(1);
  }

  if (data?.length > 0) {
    console.log("✅ Las columnas de temporada existen (id, money, current_season).");
  }

  // --- Columnas del perfil extendido (migración 011) ------------------
  console.log("\n🔎 Verificando columnas del perfil extendido (migración 011) …");

  const faltantes = [];
  for (const columna of PROFILE_COLUMNS) {
    const existe = await columnExiste(columna);
    if (existe) {
      console.log(`   ✅ managers.${columna} existe`);
    } else {
      console.log(`   ❌ managers.${columna} NO existe`);
      faltantes.push(columna);
    }
  }

  if (faltantes.length > 0) {
    console.error(
      `\n❌ La migración 011 está INCOMPLETA: faltan las columnas ${faltantes.join(", ")}.`
    );
    console.error("   Aplicá migrations/011_manager_profile_ids.sql (versión completa) en el");
    console.error("   SQL Editor del dashboard de Supabase y volvé a correr este script.\n");
    process.exit(1);
  }

  console.log("\n✅ Migración 011 completa: league_id, club_id y reputation están presentes.");
  console.log(`   Total de managers: ${data?.length ?? 0}\n`);
  for (const m of data || []) {
    console.log(
      `   • ${m.id} | money=${m.money} | season=${m.current_season}`
    );
  }
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  run();
}