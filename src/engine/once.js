// PURA. Armado del 11 titular y cálculo de rating (RECALCULADO, nunca persistido — §2.5).
// La traducción puesto ancho (POR/DEF/MED/DEL) ↔ slot fino vive SOLO en data/posiciones.js.
import { FORMACION, penalidad, SLOTS_POR_PUESTO_ANCHO, PUESTOS_ANCHOS } from '../data/posiciones.js';

export { FORMACION, penalidad, SLOTS_POR_PUESTO_ANCHO, PUESTOS_ANCHOS };

/** Rating efectivo de una carta en un slot concreto, ya descontada la penalidad. */
export function ratingEnSlot(carta, slot) {
  if (!carta) return 0;
  return Math.max(0, carta.rating - penalidad(carta.pos, slot));
}

/**
 * once: array de 11 ids (o null). Devuelve el rating RECALCULADO del 11.
 * Nunca se guarda en base como valor vivo: si se guarda, es snapshot de temporada cerrada.
 */
export function ratingOnce(once, plantel) {
  const porId = new Map(plantel.map((c) => [c.id, c]));
  let suma = 0;
  for (let i = 0; i < FORMACION.length; i++) {
    suma += ratingEnSlot(porId.get(once[i]), FORMACION[i]);
  }
  return Math.round((suma / FORMACION.length) * 10) / 10;
}

export function onceCompleto(once) {
  return once.length === FORMACION.length && once.every((id) => !!id);
}

/** Índices de slots que quedaron sin cubrir. La UI los usa para avisar en vez de fallar en silencio. */
export function slotsVacios(once) {
  return once.map((id, i) => (id ? null : i)).filter((i) => i !== null);
}

/**
 * Auto-armado (§D.2). Determinístico: no toca el RNG.
 * 1) ARQ es exclusivo de POR. Si no hay arquero en el plantel, el slot queda VACÍO —
 *    nunca se rellena en silencio con un jugador de campo.
 * 2) Los 10 slots de campo se resuelven con el algoritmo de asignación de
 *    Kuhn–Munkres ("húngaro", condición de optimalidad H1'), maximizando la suma
 *    de rating efectivo (rating − penalidad): el 11 de mayor rating posible para
 *    el plantel en esta formación. Un POR jamás sale a la cancha fuera del arco.
 */
export function autoOnce(plantel, { excluir = new Set() } = {}) {
  const libres = (plantel || []).filter((c) => c && !excluir.has(c.id));
  const once = FORMACION.map(() => null);
  const usados = new Set();

  // 1) ARQ: el mejor POR disponible; vacío si no hay.
  FORMACION.forEach((slot, i) => {
    if (slot !== 'ARQ') return;
    const arquero = libres
      .filter((c) => c.pos === 'POR' && !usados.has(c.id))
      .sort((a, b) => b.rating - a.rating)[0];
    if (arquero) {
      once[i] = arquero.id;
      usados.add(arquero.id);
    }
  });

  // 2) Campo: asignación exacta con el húngaro sobre los jugadores de campo.
  const jugadores = libres.filter((c) => !usados.has(c.id) && c.pos !== 'POR');
  const slotsCampo = FORMACION.map((s, i) => ({ s, i })).filter((x) => x.s !== 'ARQ');
  for (const [iJugador, iSlot] of asignacionOptima(jugadores, slotsCampo)) {
    once[iSlot] = jugadores[iJugador].id;
  }

  return once;
}

// Asignación jugadores→slots que maximiza la suma de rating efectivo. Reduce al
// problema de asignación de costo mínimo (Kuhn–Munkres, O(n³) con n ≤ 15): el
// costo de un jugador real en un slot real es 1000 − rating efectivo (minimizar
// la suma equivale a maximizarla). Si hay más jugadores que slots, los que no
// entran se emparejan con columnas dummy; si hay menos, los slots vacíos se
// emparejan con filas dummy y quedan null en el once.
function asignacionOptima(jugadores, slots) {
  const nFilas = jugadores.length;
  const nCols = slots.length;
  const n = Math.max(nFilas, nCols);
  const costo = (f, c) =>
    f >= nFilas || c >= nCols ? 0 : 1000 - ratingEnSlot(jugadores[f], slots[c].s);

  // Kuhn–Munkres clásico (configuración "assignment problem", minimización).
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(Infinity);
    const used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = -1;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = costo(i0 - 1, j - 1) - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  // p[c] = fila (1-based) asignada a la columna c; las dummies se descartan.
  const resultado = [];
  for (let c = 1; c <= n; c++) {
    const fila = p[c] - 1;
    if (fila < nFilas && c - 1 < nCols) resultado.push([fila, slots[c - 1].i]);
  }
  return resultado;
}
