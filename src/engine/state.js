// PURA. §2.4 del plan: UN ÚNICO camino de mutación de estado.
// Ningún otro módulo escribe sobre money/moral/fatiga/presion/ratingDelta.
import { RANGOS, ESTADO_INICIAL } from './balance.js';

export const VARIABLES = Object.keys(RANGOS);

// Contadores de saturación: si el harness ve muchos clamps, el balance está mal.
export function createEstado(overrides = {}) {
  return { ...ESTADO_INICIAL, ...overrides };
}

function clamp(v, [min, max]) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Único punto de escritura. Devuelve { estado, deltas, clamped }.
 * - efectos: { money?, moral?, fatiga?, presion?, ratingDelta? } (valores relativos)
 * - deltas: lo que REALMENTE cambió después de clampear (lo que muestra la UI)
 */
export function aplicarEfectos(estado, efectos = {}, motivo = 'sin-motivo', log = null) {
  const siguiente = { ...estado };
  const deltas = {};
  const clamped = [];

  for (const [k, raw] of Object.entries(efectos)) {
    if (raw === 0 || raw === undefined || raw === null) continue;
    if (!(k in RANGOS)) {
      throw new Error(`aplicarEfectos: variable desconocida "${k}" (motivo: ${motivo})`);
    }
    if (typeof raw !== 'number' || Number.isNaN(raw)) {
      throw new Error(`aplicarEfectos: efecto no numérico en "${k}" (motivo: ${motivo})`);
    }
    const bruto = redondear(k, siguiente[k] + raw);
    const final = redondear(k, clamp(bruto, RANGOS[k]));
    if (final !== bruto) clamped.push(k);
    deltas[k] = redondear(k, final - siguiente[k]);
    siguiente[k] = final;
  }

  if (log) log.push({ motivo, efectos, deltas, clamped });
  return { estado: siguiente, deltas, clamped };
}

function redondear(k, v) {
  // money va con 1 decimal (millones); el resto son enteros.
  return k === 'money' ? Math.round(v * 10) / 10 : Math.round(v);
}

export function resetRatingDelta(estado) {
  return { ...estado, ratingDelta: 0 };
}
