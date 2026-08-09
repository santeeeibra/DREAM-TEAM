// devActions.js — la lógica de cada botón del panel de dev. Ninguna función
// acá "inventa" datos ni simula nada por su cuenta: todas usan las mismas
// funciones que usa el juego real (openInitialPacks, getManagerCards,
// borrarManager), solo que sin las validaciones/flujo normal de por medio.
import { openInitialPacks, getManagerCards, borrarCartasDeManager } from '../data/cardsRepo.js';
import { getManagerById, borrarManager } from '../data/managersRepo.js';
import { getTemporadasDeManager } from '../data/seasonsRepo.js';
import { getDevGame, getDevManagerId } from './devContext.js';
import { ULTIMA_TEMPORADA } from '../core/constants.js';

// Escenas que existen hoy en src/scenes/, con un nombre corto para el botón.
// El "value" es el mismo string que usa game.scene.add(...) en main.js.
export const ESCENAS_DISPONIBLES = [
  { value: 'CollectionScene', label: 'Colección' },
  { value: 'PackOpeningScene', label: 'Apertura de sobres' },
  { value: 'LineupScene', label: 'Armar 11' },
  { value: 'SeasonScene', label: 'Jugar temporada' },
  { value: 'CareerSummaryScene', label: 'Resumen de carrera' },
  { value: 'CareerTimelineScene', label: 'Línea de tiempo de carrera' },
];

function requireGame() {
  const game = getDevGame();
  if (!game) {
    throw new Error('Todavía no hay un juego Phaser activo: iniciá sesión y entrá con tu DT primero.');
  }
  return game;
}

function requireManagerId() {
  const managerId = getDevManagerId();
  if (!managerId) {
    throw new Error('Todavía no hay un manager cargado: iniciá sesión y creá tu DT primero.');
  }
  return managerId;
}

// iniciarEscenaUnica arranca una escena y para cualquier OTRA que haya
// quedado corriendo. game.scene.start(key) por sí solo no hace esto: en
// el juego real nunca hace falta porque main.js siempre crea un Phaser.Game
// nuevo antes de cada pantalla (ver crearJuego() en main.js), pero el panel
// de dev reusa el mismo juego para saltar de escena en escena, así que sin
// este paso quedarían dos escenas dibujando una encima de la otra.
function iniciarEscenaUnica(game, key, data) {
  for (const escenaActiva of game.scene.getScenes(true)) {
    if (escenaActiva.scene.key !== key) {
      game.scene.stop(escenaActiva.scene.key);
    }
  }
  game.scene.start(key, data);
}

// Botón 1: corre el flujo REAL de abrir 5 sobres (draftSquad + guardar 25
// cartas nuevas en user_cards, ver openPacks.js) para el manager actual, y
// arranca la animación de PackOpeningScene. Al terminar de revelar las
// cartas, sigue al mismo lugar que sigue el juego real (LineupScene con las
// cartas recién guardadas).
export async function simularAperturaDeSobres() {
  const game = requireGame();
  const managerId = requireManagerId();

  const packs = await openInitialPacks(managerId);

  iniciarEscenaUnica(game, 'PackOpeningScene', {
    packs,
    onFinish: async () => {
      const cards = await getManagerCards(managerId);
      iniciarEscenaUnica(game, 'LineupScene', { managerId, cards });
    },
  });
}

// Botón 2: salta directo a una escena. LineupScene necesita las cartas
// reales del manager y PackOpeningScene necesita sobres recién armados, así
// que para esas dos reusamos la lógica real en vez de inventar datos.
export async function irAPantalla(nombreEscena) {
  const game = requireGame();

  if (nombreEscena === 'PackOpeningScene') {
    await simularAperturaDeSobres();
    return;
  }

  if (nombreEscena === 'LineupScene') {
    const managerId = requireManagerId();
    const cards = await getManagerCards(managerId);
    iniciarEscenaUnica(game, 'LineupScene', { managerId, cards });
    return;
  }

  if (nombreEscena === 'CollectionScene') {
    const managerId = requireManagerId();
    const cards = await getManagerCards(managerId);
    iniciarEscenaUnica(game, 'CollectionScene', { managerId, cards });
    return;
  }

  if (nombreEscena === 'SeasonScene') {
    const managerId = requireManagerId();
    iniciarEscenaUnica(game, 'SeasonScene', { managerId });
    return;
  }

  if (nombreEscena === 'CareerSummaryScene') {
    const managerId = requireManagerId();
    iniciarEscenaUnica(game, 'CareerSummaryScene', { managerId });
    return;
  }

  if (nombreEscena === 'CareerTimelineScene') {
    const managerId = requireManagerId();
    const [manager, seasons] = await Promise.all([
      getManagerById(managerId),
      getTemporadasDeManager(managerId),
    ]);
    iniciarEscenaUnica(game, 'CareerTimelineScene', {
      managerId,
      seasons,
      currentSeasonNumber: manager.current_season,
      totalSeasons: ULTIMA_TEMPORADA,
    });
    return;
  }

  iniciarEscenaUnica(game, nombreEscena);
}

// Botón 3: borra SOLO las 25 cartas del manager actual (tabla user_cards),
// sin tocar el manager ni el lineup guardado. Sirve para re-testear la
// apertura de sobres sin tener que resetear la cuenta entera.
export async function vaciarPlantel() {
  const managerId = requireManagerId();
  await borrarCartasDeManager(managerId);
}

// Botón 4: borra el manager actual. Las tablas user_cards, lineups,
// seasons y season_events tienen foreign key "on delete cascade" hacia
// managers (season_events cascadea a través de seasons), así que un solo
// delete acá alcanza para borrar todo lo asociado a este DT. Ver
// migrations/ + el schema real en Supabase para confirmar esas FKs.
export async function resetearCuenta() {
  const managerId = requireManagerId();
  await borrarManager(managerId);
}
