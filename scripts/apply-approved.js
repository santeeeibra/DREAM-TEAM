// scripts/apply-approved.js
//
// Lee pending_changes con status='approved' y aplica cada uno sobre
// `cards`, uno por uno, vía funciones de Postgres (apply_*_change en
// migrations/003_apply_approved.sql) que hacen el write + marcar
// status='applied' en una sola transacción: si algo falla, esa fila
// vuelve a quedar en 'approved' para reintentar en la próxima corrida,
// sin afectar a las demás.
//
// El rating usa calculateRating(), la misma función de
// scripts/seed-players.js (no una lógica nueva de "tier de club").

import dotenv from "dotenv";
import { pathToFileURL } from "url";
import { createClient } from "@supabase/supabase-js";
import { calculateRating } from "./seed-players.js";

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

// staging_players.position ya viene en las siglas de cards.position
// (POR/DEF/MED/DEL, mapeadas en ingest-fpl.js). calculateRating(), en
// cambio, espera los nombres en inglés que usaba API-Football.
export const POSITION_CODE_TO_LABEL = {
  POR: "Goalkeeper",
  DEF: "Defender",
  MED: "Midfielder",
  DEL: "Attacker",
};

// Traduce el elemento crudo de bootstrap-static (FPL) a la forma
// { games: { rating } } que espera calculateRating. FPL no tiene un
// "rating" de partido (0-10) como api-sports; points_per_game es el
// proxy más cercano ya calculado por FPL.
export function toPlayerStats(raw) {
  return {
    games: { rating: raw.points_per_game },
  };
}

function computeRating(stagingPlayer) {
  return calculateRating(toPlayerStats(stagingPlayer.raw_data));
}

async function fetchApproved() {
  const { data, error } = await supabase
    .from("pending_changes")
    .select("id, change_type, card_id, staging_player_id")
    .eq("status", "approved");

  if (error) {
    console.error("❌ Error leyendo pending_changes:", error.message);
    process.exit(1);
  }
  return data || [];
}

async function fetchStagingPlayer(id) {
  const { data, error } = await supabase
    .from("staging_players")
    .select("id, name, club, position, raw_data")
    .eq("id", id)
    .single();

  if (error) throw new Error(`staging_players ${id}: ${error.message}`);
  return data;
}

async function applyNewPlayer(row) {
  const sp = await fetchStagingPlayer(row.staging_player_id);
  const rating = computeRating(sp);

  const { error } = await supabase.rpc("apply_new_player_change", {
    p_pending_id: row.id,
    p_name: sp.name,
    p_club: sp.club,
    p_position: sp.position,
    p_stat_value: rating,
  });

  if (error) throw new Error(error.message);
}

async function applyClubChange(row) {
  const sp = await fetchStagingPlayer(row.staging_player_id);
  const rating = computeRating(sp);

  const { error } = await supabase.rpc("apply_club_change_change", {
    p_pending_id: row.id,
    p_card_id: row.card_id,
    p_new_club: sp.club,
    p_stat_value: rating,
  });

  if (error) throw new Error(error.message);
}

async function applyRemoved(row) {
  const { error } = await supabase.rpc("apply_removed_change", {
    p_pending_id: row.id,
    p_card_id: row.card_id,
  });

  if (error) throw new Error(error.message);
}

async function run() {
  const approved = await fetchApproved();
  console.log(`📦 ${approved.length} cambios en status='approved' para aplicar.`);

  const summary = { new_player: 0, club_change: 0, removed: 0, failed: 0 };

  for (const row of approved) {
    try {
      if (row.change_type === "new_player") {
        await applyNewPlayer(row);
        summary.new_player += 1;
      } else if (row.change_type === "club_change") {
        await applyClubChange(row);
        summary.club_change += 1;
      } else if (row.change_type === "removed") {
        await applyRemoved(row);
        summary.removed += 1;
      } else {
        console.warn(`⚠️  change_type desconocido en pending_changes ${row.id}: ${row.change_type}`);
      }
    } catch (err) {
      summary.failed += 1;
      console.error(`❌ Falló pending_changes ${row.id} (${row.change_type}):`, err.message);
    }
  }

  console.log("\n📊 RESUMEN");
  console.log(`   Cartas nuevas:       ${summary.new_player}`);
  console.log(`   Cartas actualizadas: ${summary.club_change}`);
  console.log(`   Cartas desactivadas: ${summary.removed}`);
  if (summary.failed > 0) {
    console.log(`   Fallidos (siguen en 'approved', se reintentan la próxima corrida): ${summary.failed}`);
  }
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  run();
}
