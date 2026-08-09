// scripts/reconcile.js
//
// Compara staging_players (fuente FPL) contra el catálogo `cards` y
// llena pending_changes con lo que un admin tiene que revisar. Nunca
// escribe en `cards` directamente.
//
// Matching por nombre con similitud simple (Levenshtein normalizado)
// en vez de exact match, porque los nombres pueden venir con acentos
// o formato distinto entre FPL y el catálogo actual.
//
// Nota de alcance: staging_players (source='fpl') solo cubre Premier
// League. Para no marcar como "removed" cartas de otras ligas (el
// catálogo actual también tiene La Liga, Serie A, etc. via
// scripts/seed-players.js), la detección de removidos se limita a
// cartas cuyo club aparece en el lote de FPL recién descargado.

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

const SOURCE = "fpl";
const NAME_SIMILARITY_THRESHOLD = 0.85;

function normalize(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca acentos/diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const currRow = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1, // insert
        prevRow[j] + 1, // delete
        prevRow[j - 1] + cost // substitute
      );
    }
    prevRow = currRow;
  }
  return prevRow[n];
}

function nameSimilarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  const maxLen = Math.max(na.length, nb.length, 1);
  return 1 - levenshtein(na, nb) / maxLen;
}

function findBestMatch(name, candidates) {
  let best = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = nameSimilarity(name, candidate.name);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return bestScore >= NAME_SIMILARITY_THRESHOLD ? best : null;
}

async function fetchAll(query) {
  const { data, error } = await query;
  if (error) {
    console.error("❌ Error leyendo de Supabase:", error.message);
    process.exit(1);
  }
  return data || [];
}

async function reconcile() {
  const [fplStagingPlayers, cards, existingPending] = await Promise.all([
    fetchAll(
      supabase.from("staging_players").select("id, name, club, position").eq("source", SOURCE)
    ),
    fetchAll(supabase.from("cards").select("id, name, club")),
    fetchAll(
      supabase
        .from("pending_changes")
        .select("change_type, card_id, staging_player_id")
        .eq("status", "pending")
    ),
  ]);

  console.log(
    `📦 ${fplStagingPlayers.length} jugadores en staging (source='${SOURCE}'), ${cards.length} cartas existentes en cards.`
  );

  // Evita duplicar filas en pending_changes si ya hay una pendiente
  // equivalente de una corrida anterior.
  const pendingKeys = new Set(
    existingPending.map((p) => `${p.change_type}:${p.card_id ?? ""}:${p.staging_player_id ?? ""}`)
  );

  const toInsert = [];
  const matchedCardIds = new Set();

  for (const sp of fplStagingPlayers) {
    const match = findBestMatch(sp.name, cards);

    if (!match) {
      const key = `new_player::${sp.id}`;
      if (!pendingKeys.has(key)) {
        toInsert.push({
          change_type: "new_player",
          card_id: null,
          staging_player_id: sp.id,
          payload: { name: sp.name, club: sp.club, position: sp.position },
        });
      }
      continue;
    }

    matchedCardIds.add(match.id);

    const clubChanged = normalize(match.club) !== normalize(sp.club);
    if (clubChanged) {
      const key = `club_change:${match.id}:${sp.id}`;
      if (!pendingKeys.has(key)) {
        toInsert.push({
          change_type: "club_change",
          card_id: match.id,
          staging_player_id: sp.id,
          payload: { club_viejo: match.club, club_nuevo: sp.club },
        });
      }
    }
  }

  // Clubes presentes en el lote de FPL: acota qué cartas del catálogo
  // están "en alcance" para detectar bajas (ver nota de alcance arriba).
  const fplClubs = new Set(fplStagingPlayers.map((sp) => normalize(sp.club)));

  for (const card of cards) {
    if (matchedCardIds.has(card.id)) continue;
    if (!fplClubs.has(normalize(card.club))) continue;

    const key = `removed:${card.id}:`;
    if (!pendingKeys.has(key)) {
      toInsert.push({
        change_type: "removed",
        card_id: card.id,
        staging_player_id: null,
        payload: { name: card.name, club: card.club },
      });
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("pending_changes").insert(toInsert);
    if (error) {
      console.error("❌ Error al insertar en pending_changes:", error.message);
      process.exit(1);
    }
  }

  const summary = toInsert.reduce(
    (acc, row) => {
      acc[row.change_type] += 1;
      return acc;
    },
    { new_player: 0, club_change: 0, removed: 0 }
  );

  console.log("\n📊 RESUMEN");
  console.log(`   Nuevos jugadores:  ${summary.new_player}`);
  console.log(`   Cambios de club:   ${summary.club_change}`);
  console.log(`   Removidos:         ${summary.removed}`);
  console.log(`   Total encolado en pending_changes: ${toInsert.length}`);
}

reconcile();
