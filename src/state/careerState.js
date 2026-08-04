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
import { supabase } from '../data/supabaseClient.js';
import { leagues } from '../data/leagues.js';

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
// Curva de momentum en joroba: el bonus crece con la racha hasta un pico
// (3-5 partidos) y después decae. Así una racha larga (9+) no sigue
// realimentándose sin freno como pasaba con el escalón fijo de antes.
const MOMENTUM_PICO_MIN = 3; // |streak| 3-5: pico
const MOMENTUM_PICO_MAX = 5;
const MOMENTUM_PICO_BONUS = 3;
const MOMENTUM_DECAY1_MIN = 6; // |streak| 6-8: primer decaimiento
const MOMENTUM_DECAY1_MAX = 8;
const MOMENTUM_DECAY1_BONUS = 2;
const MOMENTUM_DECAY2_MIN = 9; // |streak| 9+: segundo decaimiento
const MOMENTUM_DECAY2_BONUS = 1;
const MOMENTUM_BAJA_MIN = 1; // |streak| 1-2
const MOMENTUM_BAJA_BONUS = 1;

const PRESION_ALTA = 90;
const PRESION_ALTA_PENALTY = 4;
const PRESION_MEDIA = 70;
const PRESION_MEDIA_PENALTY = 2;

// Clamp global del ajuste combinado de getEffectiveRating (bonus de racha +
// penalización de presión + ratingDelta), ANTES de sumarse al baseRating.
// Mismo rango que RATING_DELTA_MIN/MAX pero es un concepto distinto (acá se
// clampea la suma de las tres variables, no ratingDelta solo).
const EFFECTIVE_ADJUSTMENT_MIN = -8;
const EFFECTIVE_ADJUSTMENT_MAX = 8;

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
export function initCareerState({ managerId, seasonId, money, morale, fatigue, pressure, streak, ratingDelta = 0, reputation = 50 }) {
  state = {
    managerId,
    seasonId,
    money,
    morale,
    fatigue,
    pressure,
    streak,
    ratingDelta,
    reputation,
  };
}

// setManagerProfile guarda la identidad del DT (nombre, país, liga, club y
// sus ids estables) en el estado de la carrera. La llama la pantalla de
// creación de DT (main.js) apenas se confirma la creación, y también el
// orquestador cuando resume una carrera ya existente, para que cualquier
// escena posterior (HUD de temporada, resúmenes, narrativa) pueda mostrar
// el perfil sin volver a consultar Supabase.
//
// leagueId/clubId son los slugs de leagues.js (ej. 'premier-league' /
// 'arsenal'); league/club son los nombres legacy (ej. 'Premier League' /
// 'Arsenal'). Si solo llegan los nombres (caso de managers viejos),
// resolvemos los ids con los helpers de leagues.js.
export function setManagerProfile({ name, country, league, club, leagueId = null, clubId = null }) {
  let ligaId = leagueId;
  let clubIdResuelto = clubId;

  if (!ligaId && league) ligaId = leagues.find((l) => l.league === league)?.id ?? null;
  if (!clubIdResuelto && club) {
    const liga = leagues.find((l) => l.clubs.some((c) => c.name === club));
    clubIdResuelto = liga?.clubs.find((c) => c.name === club)?.id ?? null;
  }

  state.managerProfile = {
    name,
    country,
    league,
    club,
    leagueId: ligaId,
    clubId: clubIdResuelto,
  };

  return state.managerProfile;
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

// syncMoraleFatigaDesdeTramo pone morale/fatigue de careerState en línea con
// el snapshot más reciente que trae `estado` en el orquestador (los valores
// que fue moviendo seasonSimulator.js tramo a tramo). A diferencia de
// applyEffects, que SUMA un delta a lo que ya había, esta función REEMPLAZA
// el valor: existe para el único caso en que careerState necesita ponerse al
// día con una fuente de verdad externa, justo antes de que applyEffects
// aplique el delta de un evento. Sin este paso, ese delta se sumaría sobre un
// valor de careerState potencialmente viejo (el del corte anterior) y
// pisaría en silencio la tendencia real que vino de los partidos.
//
// Acá es donde redondeamos a entero a propósito: moral/fatiga llegan con
// decimales (fórmula de reversión a la media en seasonSimulator.js, que sí
// trabaja en punto flotante), pero careerState y las columnas `smallint` de
// Supabase esperan enteros. Este es el borde entre esas dos matemáticas, así
// que el redondeo pasa acá y en ningún otro lado.
export function syncMoraleFatigaDesdeTramo({ moral, fatiga }) {
  state.morale = clamp(Math.round(moral), MORALE_MIN, MORALE_MAX);
  state.fatigue = clamp(Math.round(fatiga), FATIGUE_MIN, FATIGUE_MAX);
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

// calcularResetParcialTemporada calcula (SIN mutar `state`) los valores
// iniciales de pressure/morale/fatigue/streak para la PRÓXIMA temporada, a
// partir de cómo terminó la que se está cerrando. Es pura a propósito: la
// llama el orquestador, que decide cuándo y cómo escribir el resultado de
// vuelta en `state` — esta función no se auto-aplica para no pisarle el
// turno a quien orquesta el cierre de temporada.
//
// - pressureInicial y moraleInicial son un promedio entre lo que arrastra el
//   manager y un piso de "temporada nueva" (50 y 60 respectivamente): ni se
//   resetean del todo (una racha de presión alta no se borra de un plumazo
//   solo porque cambió el calendario) ni cruzan intactas (un cierre de
//   temporada es, en la ficción del juego, un respiro real).
// - fatigueInicial siempre arranca en 0: la fatiga es un estado físico del
//   tramo que se está jugando, no tiene sentido que un plantel arranque
//   cansado de partidos que todavía no jugó.
// - streakInicial siempre arranca en 0: una racha es una métrica de la
//   temporada en curso (ver syncStreakFromResultados), no hay racha que
//   "seguir" cuando el fixture arranca de cero.
// - money (vive en `managers`) y ratingDelta (dueño: resetRatingDeltaTemporada)
//   no aparecen acá a propósito: no son responsabilidad de esta función.
export function calcularResetParcialTemporada() {
  if (state === null) {
    throw new Error('calcularResetParcialTemporada: no hay ninguna carrera cargada en memoria (llamá a initCareerState primero)');
  }

  return {
    pressureInicial: Math.round((state.pressure + 50) / 2),
    moraleInicial: Math.round((state.morale + 60) / 2),
    fatigueInicial: 0,
    streakInicial: 0,
  };
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
  const ajusteCombinado = clamp(
    momentumPorStreak(state.streak) - penalizacionPorPresion(state.pressure) + state.ratingDelta,
    EFFECTIVE_ADJUSTMENT_MIN,
    EFFECTIVE_ADJUSTMENT_MAX
  );
  return baseRating + ajusteCombinado;
}

function momentumPorStreak(streak) {
  const magnitud = Math.abs(streak);
  const signo = Math.sign(streak);

  let bonus;
  if (magnitud >= MOMENTUM_DECAY2_MIN) bonus = MOMENTUM_DECAY2_BONUS;
  else if (magnitud >= MOMENTUM_DECAY1_MIN && magnitud <= MOMENTUM_DECAY1_MAX) bonus = MOMENTUM_DECAY1_BONUS;
  else if (magnitud >= MOMENTUM_PICO_MIN && magnitud <= MOMENTUM_PICO_MAX) bonus = MOMENTUM_PICO_BONUS;
  else if (magnitud >= MOMENTUM_BAJA_MIN) bonus = MOMENTUM_BAJA_BONUS;
  else bonus = 0;

  return signo * bonus;
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
