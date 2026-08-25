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
