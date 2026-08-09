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
