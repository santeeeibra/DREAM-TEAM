// Único lugar del mapa de posiciones/slots y de la compatibilidad entre ellos (§C.1/§D.1).
// cards.position_type en la DB solo tiene 4 valores anchos: POR, DEF, MED, DEL.
// La cancha (4-3-3) usa slots finos. Este módulo es el único que traduce entre ambos.
import { FUERZA } from '../engine/balance.js';

export const FORMACION = ['ARQ', 'DFC', 'DFC', 'LI', 'LD', 'MC', 'MC', 'MCO', 'EI', 'ED', 'DC'];

export const FORMACIONES_SLOTS = {
  '4-3-3':   ['ARQ', 'DFC', 'DFC', 'LI',  'LD', 'MC',  'MC',  'MCO', 'EI',  'ED',  'DC'],
  '4-4-2':   ['ARQ', 'DFC', 'DFC', 'LI',  'LD', 'MC',  'MC',  'MC',  'MC',  'DC',  'DC'],
  '4-2-3-1': ['ARQ', 'DFC', 'DFC', 'LI',  'LD', 'MC',  'MC',  'MCO', 'EI',  'ED',  'DC'],
  '3-5-2':   ['ARQ', 'DFC', 'DFC', 'DFC', 'MC', 'MC',  'MC',  'EI',  'ED',  'DC',  'DC'],
  '3-4-2-1': ['ARQ', 'DFC', 'DFC', 'DFC', 'MC', 'MC',  'EI',  'ED',  'MCO', 'MCO', 'DC'],
  '5-3-2':   ['ARQ', 'DFC', 'DFC', 'DFC', 'LI', 'LD',  'MC',  'MC',  'MCO', 'DC',  'DC'],
};
export const SLOTS = ['ARQ', 'DFC', 'LI', 'LD', 'MC', 'MCO', 'EI', 'ED', 'DC'];
export const PUESTOS_ANCHOS = ['POR', 'DEF', 'MED', 'DEL'];

export const SLOTS_POR_PUESTO_ANCHO = {
  POR: ['ARQ'],
  DEF: ['LI', 'LD', 'DFC'],
  MED: ['MC', 'MCO'],
  DEL: ['EI', 'ED', 'DC'],
};

const PUESTO_ANCHO_DE_SLOT = Object.fromEntries(
  Object.entries(SLOTS_POR_PUESTO_ANCHO).flatMap(([puesto, slots]) => slots.map((s) => [s, puesto]))
);

// Adyacencia entre puestos anchos: DEF-MED-DEL en línea. POR no tiene vecinos:
// el arquero es exclusivo de su slot y penalización máxima en cualquier otro (regla dura §D.2).
// Excepción fina: DFC también es exclusivo de DEF — solo un DEF lo cubre sin penalidad; un MED
// no lo tapa como vecino. LI/LD, en cambio, sí admiten vecindad de MED.
const VECINOS_PUESTO_ANCHO = { DEF: ['MED'], MED: ['DEF', 'DEL'], DEL: ['MED'] };

/** 0 = puesto natural, 5 = línea vecina, 12 = fuera de posición. Reemplaza a encaja(). */
export function penalidad(posCarta, slot) {
  if (slot === 'ARQ' || posCarta === 'POR') {
    return posCarta === 'POR' && slot === 'ARQ' ? FUERZA.PENALIDAD_POSICION.NATURAL : FUERZA.PENALIDAD_POSICION.FUERA;
  }
  if (SLOTS_POR_PUESTO_ANCHO[posCarta]?.includes(slot)) return FUERZA.PENALIDAD_POSICION.NATURAL;
  // DFC es exclusivo de DEF: superado el puesto natural, no admite vecinos (§D.2).
  if (slot === 'DFC') return FUERZA.PENALIDAD_POSICION.FUERA;
  const puestoDelSlot = PUESTO_ANCHO_DE_SLOT[slot];
  return VECINOS_PUESTO_ANCHO[posCarta]?.includes(puestoDelSlot)
    ? FUERZA.PENALIDAD_POSICION.VECINO
    : FUERZA.PENALIDAD_POSICION.FUERA;
}
