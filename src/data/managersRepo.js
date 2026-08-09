// managers.js — todo lo que tiene que ver con la tabla `managers` (el "DT"
// que crea cada usuario). La política RLS de esa tabla dice
// `auth.uid() = user_id`, así que solo se puede crear/leer el manager
// del usuario que está logueado en ese momento.
import { supabase } from './supabaseClient.js';
import { DataError } from '../core/errors.js';

// Busca si el usuario logueado ya tiene un DT creado. Devuelve el manager
// (fila completa) o null si todavía no creó ninguno.
export async function getManagerForUser(userId) {
  const { data, error } = await supabase
    .from('managers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new DataError(error.message, { causa: error });
  return data;
}

// Crea el DT del usuario logueado. `league` y `club` los controlan los dos
// <select> encadenados del formulario (ver src/data/leagues.js), no hay un
// check constraint en la base para esto.
//
// Además de los nombres (legacy), persistimos los ids estables de liga y
// club (leagueId/clubId, definidos en leagues.js) y la reputación inicial
// (reputation, 0-100). Los tres son opcionales para no romper a otros
// llamadores (p.ej. el panel de dev) que crean managers sin perfil completo.
export async function createManager({ userId, name, country, league, club, leagueId = null, clubId = null, reputation = 50 }) {
  const { data, error } = await supabase
    .from('managers')
    .insert({
      user_id: userId,
      name,
      country,
      league,
      club,
      league_id: leagueId,
      club_id: clubId,
      reputation,
    })
    .select()
    .single();

  if (error) throw new DataError(error.message, { causa: error });
  return data;
}

// Trae un manager por su id (a diferencia de getManagerForUser, que busca
// por user_id). La usa CareerSummaryScene, que recibe el managerId por
// parámetro de escena y no necesariamente tiene al usuario logueado a mano.
export async function getManagerById(managerId) {
  const { data, error } = await supabase.from('managers').select('*').eq('id', managerId).single();
  if (error) throw new DataError(error.message, { causa: error });
  return data;
}

// Borra el manager (mismo criterio que resetearCuenta() del panel de dev:
// user_cards, lineups, seasons y season_events cascadean por FK "on delete
// cascade" hacia managers, así que este único delete alcanza). Esta versión
// es para el flujo real del juego (botón "Nueva carrera" en
// CareerSummaryScene), no para el panel de dev.
export async function borrarManager(managerId) {
  const { error } = await supabase.from('managers').delete().eq('id', managerId);
  if (error) throw new DataError(error.message, { causa: error });
}
