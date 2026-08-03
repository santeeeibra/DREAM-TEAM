// careerState.js — estado en memoria de la carrera del manager (la sesión de
// juego activa: dinero, presión, racha, y el punto de apoyo entre tramos de
// moral/fatiga). A diferencia de seasonSimulator.js y eventSlots.js, este
// archivo SÍ importa Supabase: es la capa que conecta la lógica pura del
// simulador con la base de datos.
//
// -----------------------------------------------------------------------
// SINGLETON, NO CLASE
// -----------------------------------------------------------------------
//
// En este juego solo hay una carrera activa a la vez por sesión (un jugador
// jugando con un manager), así que no tiene sentido pagar el costo de una
// clase instanciable. Guardamos el estado en un único objeto module-level y
// listo.
//
// -----------------------------------------------------------------------
// REPARTO DE RESPONSABILIDADES (no te desvíes de esto)
// -----------------------------------------------------------------------
//
// - moral y fatiga DENTRO de un tramo de fechas (mientras se juegan jornadas
//   seguidas) las sigue calculando seasonSimulator.js — no se duplica esa
//   lógica acá.
// - careerState.js es dueño de money, pressure, streak y ratingDelta, y es el
//   ÚNICO lugar autorizado para tocar moral/fatiga ENTRE tramos (cuando se
//   resuelve un evento). Ningún otro archivo debe mutar estas 5 variables
//   directamente: todo pasa por applyEffects().
//
// -----------------------------------------------------------------------
// ratingDelta NO ES PROGRESO DE CARRERA
// -----------------------------------------------------------------------
//
// ratingDelta es el "estado de gracia o crisis" TEMPORAL del equipo en ESTA
// temporada: lo mueven los eventos (clave rating_efectivo del catálogo) y se
// vuelve a 0 cuando la temporada termina (ver resetRatingDeltaTemporada).
// El progreso a largo plazo del plantel NO vive acá: vive en el ratingBase que
// administra el orquestador, que es inmutable dentro de una temporada y solo
// cambia entre temporadas por una decisión explícita fuera de este sistema.
import { supabase } from '../supabaseClient.js';

// --- Clamps de las 5 variables que administra este archivo ---
const MORALE_MIN = 0;
const MORALE_MAX = 100;
const FATIGUE_MIN = 0;
const FATIGUE_MAX = 100;
const PRESSURE_MIN = 0;
const PRESSURE_MAX = 100;
const MONEY_MIN = 0; // sin techo: no hay tope de cuánto puede juntar un manager
// ratingDelta se clampea simétrico y chico a propósito: una racha de eventos
// buenos no puede convertir a un equipo mediocre en candidato, ni una de malos
// hundirlo por debajo de lo que su plantel realmente vale.
const RATING_DELTA_MIN = -8;
const RATING_DELTA_MAX = 8;

// --- Constantes de getEffectiveRating (mismo estilo que las MAYÚSCULAS de
// seasonSimulator.js) ---
const MOMENTUM_STREAK_ALTA = 3; // streak >= 3 (buena racha ganadora)
const MOMENTUM_STREAK_ALTA_BONUS = 3;
const MOMENTUM_STREAK_BAJA = 1; // streak >= 1
const MOMENTUM_STREAK_BAJA_BONUS = 1;
const MOMENTUM_STREAK_ALTA_NEG = -3; // streak <= -3 (mala racha perdedora)
const MOMENTUM_STREAK_ALTA_NEG_PENALTY = -3;
const MOMENTUM_STREAK_BAJA_NEG = -1; // streak <= -1
const MOMENTUM_STREAK_BAJA_NEG_PENALTY = -1;

const PRESION_ALTA = 90;
const PRESION_ALTA_PENALTY = 4;
const PRESION_MEDIA = 70;
const PRESION_MEDIA_PENALTY = 2;

// clamp limita un número para que no se pase de un mínimo y un máximo (mismo
// helper que usa seasonSimulator.js, repetido acá porque ese archivo no
// exporta nada: es lógica pura y no queremos acoplarlo a este módulo).
function clamp(valor, minimo, maximo) {
  return Math.max(minimo, Math.min(maximo, valor));
}

// state: el único objeto module-level que guarda la carrera activa. Nace en
// null porque hasta que no se llame a initCareerState() no hay ninguna
// carrera cargada en memoria.
let state = null;

// initCareerState carga en memoria el estado de la carrera activa. Se llama
// una sola vez al arrancar o resumir una temporada. Los valores iniciales
// vienen de una fila ya leída de `managers`/`seasons` por quien llame a
// esto — este archivo no hace el SELECT inicial, solo recibe los datos.
//
// ratingDelta arranca en 0 salvo que se lo pasen: es estado de la temporada en
// curso, no un valor de carrera, así que resumir una temporada a mitad de
// camino es el único caso donde tiene sentido pasarlo distinto de 0.
export function initCareerState({ managerId, seasonId, money, morale, fatigue, pressure, streak, ratingDelta = 0 }) {
  state = {
    managerId,
    seasonId,
    money,
    morale,
    fatigue,
    pressure,
    streak,
    ratingDelta,
  };
}

// getState devuelve una COPIA del estado actual, nunca la referencia
// interna: así nadie de afuera puede mutar money/morale/fatiga/pressure/
// streak/ratingDelta salteándose applyEffects (que es el único camino
// permitido).
export function getState() {
  return { ...state };
}

// applyEffects es el único camino de mutación de money/morale/fatiga/
// pressure/ratingDelta. Todos los deltas son opcionales (un evento puede
// afectar solo alguna variable) y todos se SUMAN a lo que ya había: nunca
// reemplazan el valor vigente. Clampeamos cada una:
//   - morale, fatigue, pressure: entre 0 y 100.
//   - money: piso en 0, sin techo (un evento que resta 500k a un manager con
//     300k no lo deja en negativo, se planta en 0).
//   - ratingDelta: entre -8 y +8. Ojo con el nombre del parámetro: acá
//     `ratingDelta` es el delta que trae UN evento, y state.ratingDelta es el
//     acumulado de todos los eventos de la temporada. Se suma uno al otro,
//     igual que las otras cuatro.
export function applyEffects({ moneyDelta = 0, moraleDelta = 0, fatigueDelta = 0, pressureDelta = 0, ratingDelta = 0 } = {}) {
  state.money = Math.max(MONEY_MIN, state.money + moneyDelta);
  state.morale = clamp(state.morale + moraleDelta, MORALE_MIN, MORALE_MAX);
  state.fatigue = clamp(state.fatigue + fatigueDelta, FATIGUE_MIN, FATIGUE_MAX);
  state.pressure = clamp(state.pressure + pressureDelta, PRESSURE_MIN, PRESSURE_MAX);
  state.ratingDelta = clamp(state.ratingDelta + ratingDelta, RATING_DELTA_MIN, RATING_DELTA_MAX);
}

// resetRatingDeltaTemporada borra el estado de gracia/crisis acumulado y deja
// la próxima temporada arrancando desde el rating real del plantel. NO toca
// money, pressure, streak, morale ni fatiga: esas cuatro cruzan de una
// temporada a la siguiente, ratingDelta no.
//
// Lo llama el orquestador cuando la temporada llega a su fin (SEASON_COMPLETE),
// que es el único momento en que corresponde.
export function resetRatingDeltaTemporada() {
  state.ratingDelta = 0;
}

// syncStreakFromResultados deriva el streak actual a partir del array
// "resultados" que ahora devuelve simularTemporadaCompleta (ver
// src/engine/seasonSimulator.js). Cuenta partidos consecutivos desde el
// final del tramo hacia atrás mientras se sostenga el mismo resultado: cada
// victoria suma streak positivo, cada derrota resta streak negativo, y un
// empate corta la racha (resetea a 0, ni suma ni resta).
//
// Diferencia con encontrarRachaMasLarga (seasonSimulator.js): esa función
// busca la racha MÁS LARGA de toda la temporada, para el resumen narrativo
// del cierre. Esta busca la racha ACTUAL, la que sigue vigente en el último
// partido jugado, porque es la que alimenta el momentum de
// getEffectiveRating.
export function syncStreakFromResultados(resultados) {
  let streak = 0;

  for (let i = resultados.length - 1; i >= 0; i--) {
    const resultado = resultados[i].resultado;

    if (resultado === 'draw') break;
    if (resultado === 'win') {
      if (streak < 0) break;
      streak++;
    } else if (resultado === 'loss') {
      if (streak > 0) break;
      streak--;
    }
  }

  state.streak = streak;
}

// getEffectiveRating NO reemplaza el cálculo interno de seasonSimulator.js
// (moral/10 - fatiga/10 sigue viviendo ahí, ver simularTemporadaCompleta).
// Es un envoltorio que ajusta el ratingPlantel de BASE antes de pasárselo al
// simulador, sumando el momentum de streak, restando la penalización de
// pressure y sumando el ratingDelta acumulado de los eventos de la temporada —
// tres variables que seasonSimulator.js no conoce porque son responsabilidad
// de este archivo.
//
// Nunca se guarda este valor en ningún lado: se recalcula cada vez que se
// pide, a partir del streak/pressure/ratingDelta vigentes en memoria.
export function getEffectiveRating(baseRating) {
  return baseRating
    + momentumPorStreak(state.streak)
    - penalizacionPorPresion(state.pressure)
    + state.ratingDelta;
}

function momentumPorStreak(streak) {
  if (streak >= MOMENTUM_STREAK_ALTA) return MOMENTUM_STREAK_ALTA_BONUS;
  if (streak >= MOMENTUM_STREAK_BAJA) return MOMENTUM_STREAK_BAJA_BONUS;
  if (streak <= MOMENTUM_STREAK_ALTA_NEG) return MOMENTUM_STREAK_ALTA_NEG_PENALTY;
  if (streak <= MOMENTUM_STREAK_BAJA_NEG) return MOMENTUM_STREAK_BAJA_NEG_PENALTY;
  return 0;
}

function penalizacionPorPresion(pressure) {
  if (pressure > PRESION_ALTA) return PRESION_ALTA_PENALTY;
  if (pressure > PRESION_MEDIA) return PRESION_MEDIA_PENALTY;
  return 0;
}

// persist guarda el estado en memoria en Supabase. Se llama SOLO en dos
// momentos: cuando se resuelve un evento (corte de tramo) y al cerrar la
// temporada — nunca fecha a fecha, para no hacer 38 escrituras a Supabase
// por temporada cuando alcanza con escribir en los cortes.
//
// Dos llamadas totales (no una por campo): un update a `seasons` (morale,
// fatigue, pressure, streak, y matchday si corresponde) y un update a
// `managers` (money).
//
// Envuelto en try/catch: si falla, logueamos el error pero no tiramos
// excepción que rompa el flujo del juego — el estado en memoria sigue
// siendo válido aunque el guardado falle, y se puede reintentar en el
// próximo corte.
export async function persist(matchday) {
  try {
    const seasonUpdate = {
      morale: state.morale,
      fatigue: state.fatigue,
      pressure: state.pressure,
      streak: state.streak,
    };
    if (matchday !== undefined) {
      seasonUpdate.matchday = matchday;
    }

    const { error: errorSeason } = await supabase
      .from('seasons')
      .update(seasonUpdate)
      .eq('id', state.seasonId);
    if (errorSeason) throw errorSeason;

    const { error: errorManager } = await supabase
      .from('managers')
      .update({ money: state.money })
      .eq('id', state.managerId);
    if (errorManager) throw errorManager;
  } catch (error) {
    console.error('careerState.persist: no se pudo guardar el estado de carrera', error);
  }
}
