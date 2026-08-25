// supabase/functions/open-pack/index.ts
//
// VERSIÓN SIMPLIFICADA PARA TESTING (sin JWT todavía).
// Recibe { pack_id, user_id } directo en el body y hace todo con
// supabase-js usando la SERVICE_ROLE_KEY (bypassea RLS a propósito,
// porque todavía no hay JWT de usuario real para resolver quién pega
// el request). Esto NO es atómico (no corre dentro de una sola
// transacción de Postgres) — sirve para probar el flujo de punta a
// punta antes de pasar a la versión con JWT + RPC transaccional.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Bandas de rareza por overall_rating y su probabilidad de aparición.
const RARITY_BANDS = [
  { name: "bronze", min: 40, max: 64, weight: 0.70 },
  { name: "silver", min: 65, max: 74, weight: 0.20 },
  { name: "gold", min: 75, max: 84, weight: 0.08 },
  { name: "special", min: 85, max: 99, weight: 0.02 },
] as const;

type Band = (typeof RARITY_BANDS)[number];

function pickBand(): Band {
  const roll = Math.random();
  let cumulative = 0;
  for (const band of RARITY_BANDS) {
    cumulative += band.weight;
    if (roll < cumulative) return band;
  }
  return RARITY_BANDS[RARITY_BANDS.length - 1];
}

// Para la 5ta carta: mínimo Silver garantizado. Si el random da
// Bronze, se vuelve a tirar solo para esa carta hasta que salga
// Silver o mejor.
function pickBandMinSilver(): Band {
  let band = pickBand();
  while (band.name === "bronze") {
    band = pickBand();
  }
  return band;
}

async function getRandomCardInBand(
  admin: ReturnType<typeof createClient>,
  band: Band,
) {
  const { data, error } = await admin
    .from("cards")
    .select("*")
    .eq("is_active", true)
    .gte("overall_rating", band.min)
    .lte("overall_rating", band.max);

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      `NO_CARDS_IN_BAND: no hay cartas activas con overall_rating entre ${band.min} y ${band.max} (${band.name})`,
    );
  }

  return data[Math.floor(Math.random() * data.length)];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  let pack_id: unknown;
  let user_id: unknown;
  try {
    const body = await req.json();
    pack_id = body?.pack_id;
    user_id = body?.user_id;
  } catch {
    return jsonResponse({ error: "Body inválido, se espera JSON" }, 400);
  }

  if (typeof pack_id !== "string" || pack_id.length === 0) {
    return jsonResponse({ error: "Falta pack_id en el body" }, 400);
  }
  if (typeof user_id !== "string" || user_id.length === 0) {
    return jsonResponse({ error: "Falta user_id en el body" }, 400);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 2. Buscar el pack y validar que exista y esté activo.
  const { data: pack, error: packError } = await supabaseAdmin
    .from("packs")
    .select("id, price_coins, active")
    .eq("id", pack_id)
    .maybeSingle();

  if (packError) {
    console.error("Error buscando pack:", packError);
    return jsonResponse({ error: "No se pudo buscar el sobre" }, 500);
  }
  if (!pack || pack.active !== true) {
    return jsonResponse({ error: "El sobre no existe o no está activo" }, 404);
  }

  // 3. Buscar al usuario y validar que tenga coins suficientes.
  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("id, coins")
    .eq("id", user_id)
    .maybeSingle();

  if (userError) {
    console.error("Error buscando usuario:", userError);
    return jsonResponse({ error: "No se pudo buscar el usuario" }, 500);
  }
  if (!user) {
    return jsonResponse({ error: "El usuario no existe" }, 404);
  }
  if (user.coins < pack.price_coins) {
    return jsonResponse(
      {
        error: `Saldo insuficiente: tenés ${user.coins} monedas y el sobre cuesta ${pack.price_coins}`,
      },
      400,
    );
  }

  // 4. Descontar price_coins de users.coins.
  const newBalance = user.coins - pack.price_coins;
  const { error: updateCoinsError } = await supabaseAdmin
    .from("users")
    .update({ coins: newBalance })
    .eq("id", user_id);

  if (updateCoinsError) {
    console.error("Error descontando coins:", updateCoinsError);
    return jsonResponse({ error: "No se pudo descontar el saldo" }, 500);
  }

  // 5. Insertar la apertura en pack_openings.
  const { data: packOpening, error: packOpeningError } = await supabaseAdmin
    .from("pack_openings")
    .insert({
      user_id,
      pack_id,
      coins_spent: pack.price_coins,
    })
    .select("id")
    .single();

  if (packOpeningError || !packOpening) {
    console.error("Error insertando pack_opening:", packOpeningError);
    return jsonResponse({ error: "No se pudo registrar la apertura del sobre" }, 500);
  }

  // 6. Elegir 5 cartas random respetando las probabilidades por banda,
  // con la 5ta carta garantizada Silver o mejor, sin duplicados dentro del sobre.
  let cards;
  try {
    const bands = [pickBand(), pickBand(), pickBand(), pickBand(), pickBandMinSilver()];
    const pickedIds = new Set<number>();
    cards = [];
    for (const band of bands) {
      let card;
      let attempts = 0;
      do {
        card = await getRandomCardInBand(supabaseAdmin, band);
        attempts++;
      } while (pickedIds.has(card.id) && attempts < 10);
      pickedIds.add(card.id);
      cards.push(card);
    }
  } catch (err) {
    console.error("Error seleccionando cartas:", err);
    return jsonResponse({ error: "No se pudieron seleccionar las cartas del sobre" }, 500);
  }

  // 7. Insertar una fila en card_instances por cada carta obtenida.
  const { error: instancesError } = await supabaseAdmin.from("card_instances").insert(
    cards.map((card) => ({
      user_id,
      card_id: card.id,
      pack_opening_id: packOpening.id,
    })),
  );

  if (instancesError) {
    console.error("Error insertando card_instances:", instancesError);
    return jsonResponse({ error: "No se pudo acreditar el inventario" }, 500);
  }

  // 8. Responder con las cartas completas y el saldo restante.
  return jsonResponse({
    success: true,
    cards,
    coins_restantes: newBalance,
  });
});
