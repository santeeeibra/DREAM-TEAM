// openPacks.js — conecta la lógica pura de draftSquad.js con Supabase:
// trae el catálogo de cartas activas, arma el plantel de 25, lo guarda en
// `user_cards` y devuelve los 5 sobres ya armados para que la escena de
// Phaser los vaya revelando.
import { supabase } from '../supabaseClient.js';
import { draftSquad, splitIntoPacks, MINIMOS_POR_POSICION } from './draftSquad.js';

// Columnas que necesita el draft (id, position) + las que necesita la
// pantalla de apertura para mostrar cada carta (nombre, foto, rating, etc).
const COLUMNAS_CARTA =
  'id, name, club, position, overall_rating, rarity, photo_url, fut_id, uses_generated_avatar, club_badge_url, nation_flag_url, league_logo_url';

async function fetchCardPool() {
  const { data, error } = await supabase.from('cards').select(COLUMNAS_CARTA).eq('is_active', true);

  if (error) throw error;
  return data;
}

// Trae los ids de las cartas que el manager ya tiene, para no volver a
// dárselas si se simula la apertura de sobres más de una vez.
async function fetchOwnedCardIds(managerId) {
  const { data, error } = await supabase.from('user_cards').select('card_id').eq('manager_id', managerId);

  if (error) throw error;
  return new Set(data.map((fila) => fila.card_id));
}

// Verifica que, después de sacar las cartas repetidas, todavía queden
// suficientes cartas por posición para cumplir los mínimos garantizados.
function verificarPoolAlcanza(pool) {
  const conteoPorPosicion = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
  for (const carta of pool) {
    if (conteoPorPosicion[carta.position] !== undefined) {
      conteoPorPosicion[carta.position] += 1;
    }
  }

  for (const [posicion, minimo] of Object.entries(MINIMOS_POR_POSICION)) {
    if (conteoPorPosicion[posicion] < minimo) {
      throw new Error('No quedan suficientes cartas nuevas para armar un plantel.');
    }
  }
}

async function saveSquad(managerId, cards) {
  const filas = cards.map((carta) => ({
    manager_id: managerId,
    card_id: carta.id,
    acquired_via: 'pack',
  }));

  // Red de seguridad: si por una condición de carrera se intenta insertar
  // una carta que el manager ya tiene, la ignoramos en vez de romper todo
  // el insert con un error de constraint duplicada.
  const { error } = await supabase
    .from('user_cards')
    .upsert(filas, { onConflict: 'manager_id,card_id', ignoreDuplicates: true });
  if (error) throw error;
}

// Arma y guarda el plantel inicial de un manager recién creado.
// Devuelve un array de 5 sobres, cada uno con 5 cartas completas
// (listas para dibujar en PackOpeningScene).
//
// Guardamos las 25 cartas en la base ANTES de mostrar la animación, así
// el plantel queda persistido aunque el jugador cierre la pestaña a mitad
// de la apertura de sobres: la animación solo "reproduce" algo que ya
// está guardado, nunca al revés.
export async function openInitialPacks(managerId) {
  const [pool, idsUsados] = await Promise.all([fetchCardPool(), fetchOwnedCardIds(managerId)]);

  // Filtramos las cartas que el manager ya tiene para que draftSquad no
  // vuelva a repartirlas (eso era lo que rompía el insert con el error de
  // constraint duplicada).
  const poolNuevo = pool.filter((carta) => !idsUsados.has(carta.id));
  verificarPoolAlcanza(poolNuevo);

  const plantel = draftSquad(poolNuevo);

  await saveSquad(managerId, plantel);

  return splitIntoPacks(plantel);
}
