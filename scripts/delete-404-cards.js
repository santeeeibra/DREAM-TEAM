// scripts/delete-404-cards.js
//
// Elimina de la tabla `cards` las filas cuyo fut_id devolvió 404 al
// intentar descargar la imagen (jugadores sin asset en fut.gg).
//
// fut_ids a borrar: 80816, 81319, 80314, 79579
//
// Por defecto corre en modo dry-run (solo muestra el preview). Para
// borrar de verdad, correr con --apply:
//   node scripts/delete-404-cards.js --apply

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

const FUT_IDS_TO_DELETE = ["80816", "81319", "80314", "79579"];
const APPLY = process.argv.includes("--apply");

async function run() {
  // -------------------------------------------------------------------
  // 1. Buscar las filas que coinciden con los fut_id.
  // -------------------------------------------------------------------
  const { data: rows, error } = await supabase
    .from("cards")
    .select("id, name, fut_id")
    .in("fut_id", FUT_IDS_TO_DELETE);

  if (error) {
    console.error("❌ Error leyendo de Supabase:", error.message);
    process.exit(1);
  }

  console.log(`🔍 ${rows.length} fila(s) encontrada(s) con fut_id 404:\n`);
  for (const r of rows) {
    console.log(`   id=${r.id}   name=${r.name}   fut_id=${r.fut_id}`);
  }

  if (rows.length === 0) {
    console.log("\n✅ No hay filas que borrar.");
    return;
  }

  if (!APPLY) {
    console.log("\n🧪 Dry-run (no se borró nada). Correr con --apply para eliminar.");
    return;
  }

  // -------------------------------------------------------------------
  // 2. Borrar las filas (solo con --apply).
  // -------------------------------------------------------------------
  const { error: deleteError, count } = await supabase
    .from("cards")
    .delete({ count: "exact" })
    .in("fut_id", FUT_IDS_TO_DELETE);

  if (deleteError) {
    console.error("❌ Error borrando de Supabase:", deleteError.message);
    process.exit(1);
  }

  console.log(`\n🗑️  Se eliminaron ${count} fila(s) de la tabla cards.`);
}

run();