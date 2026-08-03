// seasons.js — todo lo que tiene que ver con jugar una temporada: la tabla
// `seasons` (una fila por manager+temporada, con el resultado de la liga y
// moral/fatiga del plantel), `season_events` (qué opción eligió el jugador
// en cada evento de la temporada) y `events_catalog` (el catálogo de
// eventos disponibles). Es lógica de datos (habla con Supabase), sin nada
// de Phaser: eso vive en src/scenes/SeasonScene.js, que usa estas funciones
// igual que LineupScene.js usa lineups.js.
import { supabase } from './supabaseClient.js';
import { getLineup } from './lineups.js';
import {
  MORAL_INICIAL_POR_DEFECTO as MORAL_INICIAL,
  FATIGA_INICIAL_POR_DEFECTO as FATIGA_INICIAL,
} from './engine/seasonSimulator.js';

// getManagerParaTemporada trae los datos del manager que necesita
// SeasonScene antes de arrancar: `current_season` (para resolver la
// temporada si no vino explícita) y `money` (los eventos pueden afectarlo).
export async function getManagerParaTemporada(managerId) {
  const { data, error } = await supabase
    .from('managers')
    .select('id, money, current_season')
    .eq('id', managerId)
    .single();
  if (error) throw error;
  return data;
}

// calcularRatingDelOnce promedia (redondeado) el overall_rating de las
// cartas pasadas: el rating "de papel" del plantel (escala 0-99, la misma
// que usa cards.overall_rating y que espera seasonSimulator.js como
// `ratingPlantel`). Es pura (sin Supabase) para poder calcularse tanto acá
// (ratingDelOnceTitular, que primero busca las cartas en la base) como en
// LineupScene.confirmar(), que ya tiene las cartas seleccionadas en memoria
// y no necesita ir a buscarlas de nuevo.
export function calcularRatingDelOnce(starterCards) {
  const suma = starterCards.reduce((acumulado, carta) => acumulado + carta.overall_rating, 0);
  return Math.round(suma / starterCards.length);
}

// ratingDelOnceTitular calcula el rating "de papel" del plantel a partir del
// 11 titular guardado en `lineups.slots.starters` (a diferencia de
// calcularRatingDelOnce, que recibe las cartas directamente, esta arranca
// solo con managerId/seasonNumber y busca las cartas en la base).
export async function ratingDelOnceTitular(managerId, seasonNumber) {
  const lineup = await getLineup(managerId, seasonNumber);
  if (!lineup || !lineup.slots?.starters?.length) {
    throw new Error('Este manager todavía no tiene un 11 titular guardado para esta temporada.');
  }

  const userCardIds = lineup.slots.starters.map((titular) => titular.card_id);
  const { data, error } = await supabase
    .from('user_cards')
    .select('id, cards (overall_rating)')
    .in('id', userCardIds);
  if (error) throw error;

  return calcularRatingDelOnce(data.map((fila) => fila.cards));
}

// ensureSeason guarda el rating snapshot del 11 titular (seasons.rating:
// "OVR promedio del 11 en el momento de confirmar el lineup", ver comment
// de la columna) en la fila de `seasons` de este manager/temporada. Si la
// fila no existe todavía la crea con los defaults de morale/fatigue
// (mismo criterio que getOrCreateSeasonRow); si ya existe, actualiza el
// rating para reflejar el 11 recién confirmado (es un snapshot: cambia
// cuando el usuario vuelve a confirmar un 11 distinto, pero no se
// recalcula solo con el paso de las fechas).
export async function ensureSeason(managerId, seasonNumber, rating) {
  const { data: existente, error: errorBusqueda } = await supabase
    .from('seasons')
    .select('id')
    .eq('manager_id', managerId)
    .eq('season_number', seasonNumber)
    .maybeSingle();
  if (errorBusqueda) throw errorBusqueda;

  if (existente) {
    const { data, error } = await supabase
      .from('seasons')
      .update({ rating })
      .eq('id', existente.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('seasons')
    .insert({
      manager_id: managerId,
      season_number: seasonNumber,
      rating,
      morale: MORAL_INICIAL,
      fatigue: FATIGA_INICIAL,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// getOrCreateSeasonRow trae la fila de `seasons` para este manager y
// temporada, o la crea si todavía no existe (por ejemplo, la primera vez
// que este manager entra a SeasonScene para su temporada 1). Al crearla se
// le puede pasar moral/fatiga heredadas del cierre de la temporada
// anterior; si no se pasan, arranca con los defaults de la columna.
export async function getOrCreateSeasonRow(
  managerId,
  seasonNumber,
  moralHeredada = MORAL_INICIAL,
  fatigaHeredada = FATIGA_INICIAL
) {
  const { data: existente, error: errorBusqueda } = await supabase
    .from('seasons')
    .select('*')
    .eq('manager_id', managerId)
    .eq('season_number', seasonNumber)
    .maybeSingle();
  if (errorBusqueda) throw errorBusqueda;
  if (existente) return existente;

  const { data: creada, error: errorCreacion } = await supabase
    .from('seasons')
    .insert({
      manager_id: managerId,
      season_number: seasonNumber,
      morale: moralHeredada,
      fatigue: fatigaHeredada,
    })
    .select()
    .single();
  if (errorCreacion) throw errorCreacion;
  return creada;
}

// getEventosActivos trae el catálogo de eventos disponibles (active=true),
// que es lo que necesita elegirEventosDeTemporada() (src/engine/eventSlots.js)
// para armar el calendario de eventos de la temporada.
export async function getEventosActivos() {
  const { data, error } = await supabase.from('events_catalog').select('*').eq('active', true);
  if (error) throw error;
  return data;
}

// guardarEventoResuelto anota en `season_events` qué opción eligió el
// jugador para un evento puntual de la temporada y qué efectos se le
// aplicaron, ya resuelto (resolved=true: en esta versión un evento se
// resuelve apenas el jugador elige, no queda ninguno pendiente).
export async function guardarEventoResuelto(seasonId, eventCode, matchday, chosenOption, effectsApplied) {
  const { error } = await supabase.from('season_events').insert({
    season_id: seasonId,
    event_code: eventCode,
    matchday,
    chosen_option: chosenOption,
    effects_applied: effectsApplied,
    resolved: true,
  });
  if (error) throw error;
}

// cerrarTemporada actualiza la fila de `seasons` con el resultado final de
// jugar las 38 fechas (lo que devuelve simularTemporadaCompleta) y la
// moral/fatiga con las que terminó, marcándola completed=true.
export async function cerrarTemporada(seasonId, resumen, moralFinal, fatigaFinal) {
  const { data, error } = await supabase
    .from('seasons')
    .update({
      wins: resumen.wins,
      draws: resumen.draws,
      losses: resumen.losses,
      goals_for: resumen.goals_for,
      goals_against: resumen.goals_against,
      points: resumen.points,
      league_position: resumen.league_position,
      morale: moralFinal,
      fatigue: fatigaFinal,
      completed: true,
    })
    .eq('id', seasonId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// actualizarMoneyManager guarda el dinero del manager después de sumarle
// (o restarle) lo que hayan aportado los eventos de la temporada. `money`
// vive en `managers`, no en `seasons`, así que es una llamada aparte de
// cerrarTemporada.
export async function actualizarMoneyManager(managerId, nuevoMonto) {
  const { error } = await supabase.from('managers').update({ money: nuevoMonto }).eq('id', managerId);
  if (error) throw error;
}

// getTemporadasDeManager trae TODAS las filas de `seasons` de un manager
// (una por temporada jugada/en curso), ordenadas por número de temporada.
// La usa CareerSummaryScene para armar el resumen de carrera completo.
export async function getTemporadasDeManager(managerId) {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('manager_id', managerId)
    .order('season_number', { ascending: true });
  if (error) throw error;
  return data;
}

// crearSiguienteTemporada sube manager.current_season y crea la fila de
// `seasons` para la temporada que sigue, heredando la moral/fatiga con las
// que terminó la anterior.
export async function crearSiguienteTemporada(managerId, seasonNumberActual, moralHeredada, fatigaHeredada) {
  const siguienteNumero = seasonNumberActual + 1;

  const { error } = await supabase
    .from('managers')
    .update({ current_season: siguienteNumero })
    .eq('id', managerId);
  if (error) throw error;

  return getOrCreateSeasonRow(managerId, siguienteNumero, moralHeredada, fatigaHeredada);
}
