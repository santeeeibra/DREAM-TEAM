// eventSlots.js — sorteo de eventos de temporada.
//
// Cada temporada (liga de 38 fechas) tiene un puñado de "eventos" repartidos
// en momentos clave del calendario (pretemporada, arranque, ecuador, recta
// final, cierre). Este módulo decide, al empezar la temporada, cuántos de
// esos momentos van a tener evento, cuáles, y qué evento le toca a cada uno.
// Es lógica pura (nada de Supabase, nada de Phaser) para poder testearla
// tirando muchos sorteos y chequeando que la distribución sea razonable.

// SLOTS: los momentos del calendario donde puede caer un evento, cada uno
// atado a la fecha (matchday) de la liga en la que se dispara.
export const SLOTS = [
  { code: 'PRETEMPORADA', matchday: 1 },
  { code: 'ARRANQUE', matchday: 8 },
  { code: 'ECUADOR', matchday: 19 },
  { code: 'RECTA_FINAL', matchday: 30 },
  { code: 'CIERRE', matchday: 38 },
];

const MIN_EVENTOS = 3;
const MAX_EVENTOS = 5;

// enteroAleatorioEntre devuelve un entero uniforme en [minimo, maximo].
function enteroAleatorioEntre(minimo, maximo) {
  return minimo + Math.floor(Math.random() * (maximo - minimo + 1));
}

// elegirSlotsAlAzar sortea `cantidad` slots distintos de SLOTS (sin repetir),
// usando un shuffle parcial tipo Fisher-Yates.
function elegirSlotsAlAzar(cantidad) {
  const disponibles = [...SLOTS];
  const elegidos = [];
  for (let i = 0; i < cantidad; i++) {
    const indice = Math.floor(Math.random() * disponibles.length);
    elegidos.push(disponibles[indice]);
    disponibles.splice(indice, 1);
  }
  return elegidos;
}

// elegirEventoPonderado sortea un evento de la lista con probabilidad
// proporcional a su `weight` (mismo criterio de suma acumulada que usa el
// sorteo de bandas de rareza al abrir un sobre: a mayor weight, mayor
// probabilidad de salir).
function elegirEventoPonderado(eventos) {
  const pesoTotal = eventos.reduce((suma, evento) => suma + evento.weight, 0);
  const roll = Math.random() * pesoTotal;
  let acumulado = 0;
  for (const evento of eventos) {
    acumulado += evento.weight;
    if (roll < acumulado) return evento;
  }
  return eventos[eventos.length - 1];
}

// elegirEventosDeTemporada arma el calendario de eventos de una temporada.
//
// eventosDisponibles: filas de events_catalog con active=true, cada una con
// al menos { min_matchday, weight, ...resto de columnas del catálogo }.
//
// Devuelve un array ordenado por matchday ascendente:
//   [{ slot, matchday, evento }, ...]
export function elegirEventosDeTemporada(eventosDisponibles) {
  const cantidadEventos = enteroAleatorioEntre(MIN_EVENTOS, MAX_EVENTOS);
  const slotsElegidos = elegirSlotsAlAzar(cantidadEventos);

  const resultado = [];
  for (const slot of slotsElegidos) {
    const candidatos = eventosDisponibles.filter(
      (evento) => evento.min_matchday <= slot.matchday
    );
    if (candidatos.length === 0) continue;

    const evento = elegirEventoPonderado(candidatos);
    resultado.push({ slot: slot.code, matchday: slot.matchday, evento });
  }

  resultado.sort((a, b) => a.matchday - b.matchday);
  return resultado;
}

// ---------------------------------------------------------------------------
// LigaPro: eventos para temporada de 16 fechas.
// ---------------------------------------------------------------------------

export const SLOTS_LIGAPRO = [
  { code: 'APERTURA', matchday: 3 },
  { code: 'INTERMEDIO', matchday: 9 },
  { code: 'CLAUSURA', matchday: 15 },
];

const MIN_EVENTOS_LIGAPRO = 2;
const MAX_EVENTOS_LIGAPRO = 3;

/**
 * Elige eventos de temporada para LigaPro (16 fechas).
 * @param {Array} eventosDisponibles — filas de events_catalog con active=true
 * @returns {Array<{ slot, matchday, evento }>}
 */
export function elegirEventosDeTemporadaLigaPro(eventosDisponibles) {
  const cantidad = MIN_EVENTOS_LIGAPRO + Math.floor(Math.random() * (MAX_EVENTOS_LIGAPRO - MIN_EVENTOS_LIGAPRO + 1));
  const disponibles = [...SLOTS_LIGAPRO];
  const elegidos = [];
  for (let i = 0; i < cantidad && disponibles.length > 0; i++) {
    const idx = Math.floor(Math.random() * disponibles.length);
    elegidos.push(disponibles[idx]);
    disponibles.splice(idx, 1);
  }

  const resultado = [];
  for (const slot of elegidos) {
    const candidatos = eventosDisponibles.filter(e => e.min_matchday <= slot.matchday);
    if (candidatos.length === 0) continue;
    const evento = elegirEventoPonderado(candidatos);
    resultado.push({ slot: slot.code, matchday: slot.matchday, evento });
  }

  resultado.sort((a, b) => a.matchday - b.matchday);
  return resultado;
}

/**
 * Construye los momentos destacados para una temporada de LigaPro (16 fechas).
 * Muestra progreso del equipo en las 3 zonas del torneo.
 *
 * @param {number} jugados — cantidad de partidos jugados hasta ahora
 * @param {number} total — 16
 * @returns {Array<{ jornada, texto }>}
 */
export function construirMomentosLigaPro(jugados, total = 16) {
  const momentos = [];
  if (total <= 0) return momentos;

  const tercio = Math.ceil(total / 3);
  const dosTercios = Math.ceil((total * 2) / 3);

  if (jugados >= tercio) {
    momentos.push({ jornada: tercio, texto: '📊 Primer tercio completado' });
  }
  if (jugados >= dosTercios) {
    momentos.push({ jornada: dosTercios, texto: '🔥 ¡Recta final!' });
  }

  return momentos;
}
