// scripts/backfill-manager-reputation.js
//
// Repara datos legacy en la tabla `managers`: la columna `reputation`
// (agregada por migrations/011_manager_profile_ids.sql) nació como nullable
// fuera de migrations/, así que los managers creados antes de la 011 quedaron
// con reputation = null en vez del default 50 ("neutral").
//
// Este script setea reputation = 50 en todos los managers que la tengan null.
// Es idempotente: correrlo dos veces no cambia nada.
//
// Uso:
//   node scripts/backfill-manager-reputation.js

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

async function run() {
  console.log("🔎 Buscando managers con reputation null …");

  const { data: nulos, error: errorBusqueda } = await supabase
    .from("managers")
    .select("id")
    .is("reputation", null);

  if (errorBusqueda) {
    console.error("❌ La consulta falló:", errorBusqueda.message);
    process.exit(1);
  }

  const ids = (nulos || []).map((m) => m.id);
  if (ids.length === 0) {
    console.log("✅ No hay managers con reputation null: nada que hacer.");
    return;
  }

  console.log(`   Hay ${ids.length} manager(s) con reputation null. Backfilleando a 50 …`);

  const { error: errorUpdate } = await supabase
    .from("managers")
    .update({ reputation: 50 })
    .is("reputation", null);

  if (errorUpdate) {
    console.error("❌ El update falló:", errorUpdate.message);
    process.exit(1);
  }

  console.log(`✅ Se setearon reputation = 50 en ${ids.length} manager(s).`);
  console.log("   Verificá con: node scripts/check-manager-schema.js");
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  run();
}