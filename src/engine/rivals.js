// rivals.js — generación de la fuerza de los 19 rivales de liga al arrancar
// una temporada. Antes duplicada en src/scenes/SeasonScene.js (con
// Phaser.Math.Clamp) y scripts/simulate-career.js (reescrita a mano sin
// Phaser porque ese harness no puede importarlo). Sin dependencia de Phaser
// para que la puedan importar ambos.
import {
  CANTIDAD_RIVALES,
  RIVALES_SPREAD,
  RIVALES_MIN,
  RIVALES_MAX,
} from '../core/constants.js';

export { CANTIDAD_RIVALES, RIVALES_SPREAD, RIVALES_MIN, RIVALES_MAX };

// RIVALES_NOMBRES — pool fijo de 19 nombres de club FICTICIOS (no clubes
// reales), uno por rival de la liga. El índice de este array es el mismo
// índice que usa rivalesFuerza (ver INDEXADO DE rivalesFuerza en
// seasonSimulator.js), así que mismo índice = mismo rival durante toda la
// temporada. A diferencia de rivalesFuerza no hace falta "generarlo": es
// siempre el mismo pool, en el mismo orden.
export const RIVALES_NOMBRES = [
  'Real Norte',
  'Atlético del Sur',
  'Deportivo Central',
  'Unión FC',
  'Estrella Federal',
  'Náutico',
  'Independiente Este',
  'Sporting Andino',
  'Racing del Litoral',
  'Vélez del Oeste',
  'Gimnasia FC',
  'Rosario Unido',
  'Talleres del Valle',
  "Newell's del Puerto",
  'Colón Federal',
  'Patronato Sur',
  'Belgrano Central',
  'Instituto FC',
  'Godoy Oeste',
];

function clamp(valor, minimo, maximo) {
  return Math.max(minimo, Math.min(maximo, valor));
}

export function generarRivalesFuerza(ratingBase) {
  const rivales = [];
  for (let i = 0; i < CANTIDAD_RIVALES; i++) {
    const ruido = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    rivales.push(Math.round(clamp(ratingBase + ruido * RIVALES_SPREAD, RIVALES_MIN, RIVALES_MAX)));
  }
  return rivales;
}
