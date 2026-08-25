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

// ---------------------------------------------------------------------------
// LigaPro: generación de rivales basada en clubes reales de la config.
// ---------------------------------------------------------------------------

function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Genera rivales para un equipo en LigaPro.
 * @param {string} equipoNombre
 * @param {string} zona — 'Zona A' | 'Zona B'
 * @param {Array} clubes — ligaConfig.clubs
 * @param {function} [rng=Math.random]
 * @returns {{ rivalesFuerza: Map, rivalesNombres: Map, mismaZona: Array, otraZona: Array }}
 */
export function generarRivalesLigaPro(equipoNombre, zona, clubes, rng = Math.random) {
  const mismaZona = [];
  const otraZona = [];
  for (const club of clubes) {
    if (club.name === equipoNombre) continue;
    (club.zone === zona ? mismaZona : otraZona).push(club);
  }
  const mismaZonaMezclada = shuffle(mismaZona, rng);
  const otraZonaMezclada = shuffle(otraZona, rng);

  const rivalesFuerza = new Map();
  const rivalesNombres = new Map();
  for (const c of mismaZonaMezclada) { rivalesFuerza.set(c.name, c.fuerza); rivalesNombres.set(c.name, c.name); }
  for (const c of otraZonaMezclada) { rivalesFuerza.set(c.name, c.fuerza); rivalesNombres.set(c.name, c.name); }

  return { rivalesFuerza, rivalesNombres, mismaZona: mismaZonaMezclada, otraZona: otraZonaMezclada };
}

/**
 * Genera fixture completo de 16 fechas para LigaPro.
 * 14 intra-zona + 2 inter-zona (1 clásico + 1 sorteo).
 * Los partidos inter-zonales se mezclan aleatoriamente entre las 16 jornadas.
 */
export function generarFixtureLigaPro(equipoNombre, zona, clubes, rng = Math.random) {
  const { mismaZona, otraZona } = generarRivalesLigaPro(equipoNombre, zona, clubes, rng);

  // Armar los 16 partidos: 14 intra + 1 clasico + 1 sorteo
  const partidos = [];

  for (let i = 0; i < mismaZona.length; i++) {
    partidos.push({
      rivalNombre: mismaZona[i].name,
      rivalFuerza: mismaZona[i].fuerza,
      esLocal: i % 2 === 0,
      tipo: 'intra',
    });
  }

  // Clásico fijo
  const clasicoInfo = getClasicoEquipo(equipoNombre, zona);
  if (clasicoInfo) {
    const clubRival = otraZona.find(c => c.name === clasicoInfo.rival);
    if (clubRival) {
      partidos.push({
        rivalNombre: clubRival.name,
        rivalFuerza: clubRival.fuerza,
        esLocal: rng() > 0.5,
        tipo: 'clasico',
      });
    }
  }

  // Sorteo inter-zonal (excluir clásico)
  const clasicoNombre = clasicoInfo?.rival;
  const sorteoPool = otraZona.filter(c => c.name !== clasicoNombre);
  if (sorteoPool.length > 0) {
    const sorteo = sorteoPool[Math.floor(rng() * sorteoPool.length)];
    partidos.push({
      rivalNombre: sorteo.name,
      rivalFuerza: sorteo.fuerza,
      esLocal: rng() > 0.5,
      tipo: 'sorteo',
    });
  }

  // Mezclar los 16 partidos en las 16 jornadas
  const shuffled = shuffle(partidos, rng);
  return shuffled.map((p, i) => ({ jornada: i + 1, ...p }));
}
