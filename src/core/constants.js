// constants.js — constantes de dominio compartidas entre módulos.

// Duración de una carrera completa (temporadas). Antes duplicada en
// src/dev/devActions.js y src/scenes/SeasonScene.js.
export const ULTIMA_TEMPORADA = 8;

// Forma de la liga: 19 rivales x ida y vuelta = 38 fechas. Antes duplicada
// en src/engine/seasonSimulator.js y src/scenes/SeasonScene.js.
export const CANTIDAD_RIVALES = 19;
export const TOTAL_MATCHDAYS = 38;

// Generación de la fuerza de rivales al arrancar una temporada
// (src/scenes/SeasonScene.js).
export const RIVALES_SPREAD = 14;
export const RIVALES_MIN = 40;
export const RIVALES_MAX = 99;

// -----------------------------------------------------------------------
// PLAY-OFFS — LIGA PROFESIONAL ARGENTINA
// -----------------------------------------------------------------------
//
// La LigaPro tiene un formato especial: 30 equipos divididos en 2 zonas
// de 15 equipos cada una. Cada equipo juega 16 partidos en la fase regular:
// - 14 partidos contra rivales de su misma zona
// - 2 partidos interzonales (1 clásico rival + 1 sorteo)
//
// Los 8 mejores de cada zona (16 equipos totales) clasifican a los play-offs:
// - Octavos de final (16 → 8)
// - Cuartos de final (8 → 4)
// - Semifinales (4 → 2)
// - Final (2 → 1 campeón, cancha neutral)
//
// Localía: el mejor posicionado en la fase regular define la sede, excepto
// en la final que se juega en cancha neutral.

export const LIGAPRO_EQUIPOS_POR_ZONA = 15;
export const LIGAPRO_TOTAL_EQUIPOS = 30;
export const LIGAPRO_FASE_REGULAR_MATCHDAYS = 16;
export const LIGAPRO_CLASIFICADOS_POR_ZONA = 8;

// ---------------------------------------------------------------------------
// Clásicos fijos: cada equipo de Zona A tiene un rival clásico en Zona B.
// ---------------------------------------------------------------------------

const CLASICOS_ZONA_A = {
  'River Plate':        'Boca Juniors',
  'Independiente':      'Racing Club',
  'San Lorenzo':        'Huracán',
  'Estudiantes (LP)':   'Gimnasia (LP)',
  'Vélez Sarsfield':    'Ferro',
  'All Boys':           'Chacarita Juniors',
  'Nueva Chicago':      'Almirante Brown',
  'Deportivo Morón':    'Atlanta',
};

export const CLASICOS = Object.freeze({
  'Zona A': Object.freeze(CLASICOS_ZONA_A),
});

/**
 * Dado un equipo y su zona, devuelve su rival clásico y la zona del rival.
 * Si no tiene clásico definido, devuelve null.
 *
 * @param {string} nombreEquipo
 * @param {string} zona — 'Zona A' | 'Zona B'
 * @returns {{ rival: string, zonaRival: string } | null}
 */
export function getClasicoEquipo(nombreEquipo, zona) {
  const tabla = CLASICOS[zona];
  if (!tabla) {
    // Buscar si el equipo está en la zona opuesta
    const zonaOpuesta = zona === 'Zona A' ? 'Zona B' : 'Zona A';
    const tablaOpuesta = CLASICOS[zonaOpuesta];
    if (!tablaOpuesta) return null;
    for (const [key, rival] of Object.entries(tablaOpuesta)) {
      if (rival === nombreEquipo) {
        return { rival: key, zonaRival: zonaOpuesta };
      }
    }
    return null;
  }
  const rival = tabla[nombreEquipo];
  if (!rival) return null;
  return { rival, zonaRival: zona === 'Zona A' ? 'Zona B' : 'Zona A' };
}
