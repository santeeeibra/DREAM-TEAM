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
 * 2) El resto se asigna por pares (slot, carta) ordenados por penalidad ascendente y
 *    rating descendente: primero todos los puestos naturales, después vecinos, después fuera.
 * 3) Último recurso: si sobran slots y solo quedan arqueros, se usan igual.
 */
export function autoOnce(plantel, { excluir = new Set() } = {}) {
  const libres = (plantel || []).filter((c) => c && !excluir.has(c.id));
  const once = FORMACION.map(() => null);
  const usados = new Set();

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

  const pares = [];
  FORMACION.forEach((slot, i) => {
    if (slot === 'ARQ') return;
    for (const c of libres) {
      if (c.pos === 'POR') continue; // un arquero sale a la cancha solo en el paso 3
      pares.push({ i, id: c.id, pen: penalidad(c.pos, slot), rating: c.rating });
    }
  });
  pares.sort((a, b) => a.pen - b.pen || b.rating - a.rating);
  for (const p of pares) {
    if (once[p.i] !== null || usados.has(p.id)) continue;
    once[p.i] = p.id;
    usados.add(p.id);
  }

  const sobrantes = libres.filter((c) => !usados.has(c.id)).sort((a, b) => b.rating - a.rating);
  for (let i = 0; i < once.length && sobrantes.length; i++) {
    if (once[i] !== null) continue;
    if (FORMACION[i] === 'ARQ') continue; // sigue siendo exclusivo: mejor vacío que un DEL al arco
    once[i] = sobrantes.shift().id;
  }

  return once;
}
