// managers.js — todo lo que tiene que ver con la tabla `managers` (el "DT"
// que crea cada usuario). La política RLS de esa tabla dice
// `auth.uid() = user_id`, así que solo se puede crear/leer el manager
// del usuario que está logueado en ese momento.
import { supabase } from './supabaseClient.js';

// Busca si el usuario logueado ya tiene un DT creado. Devuelve el manager
// (fila completa) o null si todavía no creó ninguno.
export async function getManagerForUser(userId) {
  const { data, error } = await supabase
    .from('managers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Crea el DT del usuario logueado. `league` y `club` los controlan los dos
// <select> encadenados del formulario (ver src/data/leagues.js), no hay un
// check constraint en la base para esto.
export async function createManager({ userId, name, country, league, club }) {
  const { data, error } = await supabase
    .from('managers')
    .insert({
      user_id: userId,
      name,
      country,
      league,
      club,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Trae un manager por su id (a diferencia de getManagerForUser, que busca
// por user_id). La usa CareerSummaryScene, que recibe el managerId por
// parámetro de escena y no necesariamente tiene al usuario logueado a mano.
export async function getManagerById(managerId) {
  const { data, error } = await supabase.from('managers').select('*').eq('id', managerId).single();
  if (error) throw error;
  return data;
}

// Borra el manager (mismo criterio que resetearCuenta() del panel de dev:
// user_cards, lineups, seasons y season_events cascadean por FK "on delete
// cascade" hacia managers, así que este único delete alcanza). Esta versión
// es para el flujo real del juego (botón "Nueva carrera" en
// CareerSummaryScene), no para el panel de dev.
export async function borrarManager(managerId) {
  const { error } = await supabase.from('managers').delete().eq('id', managerId);
  if (error) throw error;
}
