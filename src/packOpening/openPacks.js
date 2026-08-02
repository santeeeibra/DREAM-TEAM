// openPacks.js — conecta la lógica pura de draftSquad.js con Supabase:
// trae el catálogo de cartas activas, arma el plantel de 25, lo guarda en
// `user_cards` y devuelve los 5 sobres ya armados para que la escena de
// Phaser los vaya revelando.
import { supabase } from '../supabaseClient.js';
import { draftSquad, splitIntoPacks } from './draftSquad.js';

// Columnas que necesita el draft (id, position) + las que necesita la
// pantalla de apertura para mostrar cada carta (nombre, foto, rating, etc).
const COLUMNAS_CARTA = 'id, name, club, position, overall_rating, rarity, photo_url';

async function fetchCardPool() {
  const { data, error } = await supabase.from('cards').select(COLUMNAS_CARTA).eq('is_active', true);

  if (error) throw error;
  return data;
}

async function saveSquad(managerId, cards) {
  const filas = cards.map((carta) => ({
    manager_id: managerId,
    card_id: carta.id,
    acquired_via: 'pack',
  }));

  const { error } = await supabase.from('user_cards').insert(filas);
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
  const pool = await fetchCardPool();
  const plantel = draftSquad(pool);

  await saveSquad(managerId, plantel);

  return splitIntoPacks(plantel);
}
