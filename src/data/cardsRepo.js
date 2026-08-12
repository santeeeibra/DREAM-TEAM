// cardsRepo.js — todo lo relacionado a las cartas que posee un manager:
// leerlas (getManagerCards) y armar/guardar el plantel inicial al abrir los
// 3 sobres (openInitialPacks, portado de packOpening/openPacks.js).
import { supabase } from './supabaseClient.js';
import { draftSquad, splitIntoPacks, MINIMOS_POR_POSICION } from '../packOpening/draftSquad.js';
import { DataError } from '../core/errors.js';

// getManagerCards trae las cartas que efectivamente posee un manager
// (join entre `user_cards`, la tabla de inventario, y `cards`, el catálogo),
// en el formato que ya esperan CardSprite/RevealCardSprite (name, club,
// position, overall_rating, rarity, photo_url, etc).
//
// Le agregamos `user_card_id` (el id de la fila en user_cards, o sea "esta
// copia puntual que tiene el manager") separado de `id` (que queda como el
// id de la carta en el catálogo `cards`, el mismo que usan las fotos
// precargadas). Guardamos los lineups con user_card_id para no confundir
// nunca "qué jugador es" con "cuál de mis copias es".
export async function getManagerCards(managerId) {
  const { data, error } = await supabase
    .from('user_cards')
    .select(
      'id, cards (id, name, club, position, overall_rating, rarity, photo_url, fut_id, uses_generated_avatar, club_badge_url, nation_flag_url, league_logo_url)'
    )
    .eq('manager_id', managerId);

  if (error) throw new DataError(error.message, { causa: error });

  return data
    .map((fila) => ({
      ...fila.cards,
      user_card_id: fila.id,
    }))
    // Solo cartas con foto real: los jugadores con photo_url null/undefined
    // o vacío no se muestran en el juego (evita fallos al cargar texturas).
    .filter((carta) => carta.photo_url && carta.photo_url.trim() !== '');
}

// Borra todas las cartas (user_cards) de un manager sin tocar el manager
// ni el lineup guardado. La usa el panel de dev para re-testear la
// apertura de sobres sin resetear la cuenta entera.
export async function borrarCartasDeManager(managerId) {
  const { error } = await supabase.from('user_cards').delete().eq('manager_id', managerId);
  if (error) throw new DataError(error.message, { causa: error });
}

// openInitialPacks.js — conecta la lógica pura de draftSquad.js con
// Supabase: trae el catálogo de cartas activas, arma el plantel de 15
// (3 sobres × 5), lo guarda en `user_cards` y devuelve los 3 sobres ya
// armados para que la UI de apertura los vaya revelando.

// Columnas que necesita el draft (id, position) + las que necesita la
// pantalla de apertura para mostrar cada carta (nombre, foto, rating, etc).
// `league_id` viaja en cada carta: el motor la guarda en el shape normalizado.
const COLUMNAS_CARTA =
  'id, name, club, position, overall_rating, rarity, photo_url, fut_id, uses_generated_avatar, club_badge_url, nation_flag_url, league_logo_url, league_id';

// Trae el catálogo de cartas activas. Con `leagueId` (slug de cards.league_id,
// ej. 'premier' | 'laliga' | 'seriea') filtra el pool a una liga: el draft
// inicial siempre entrega cartas de la liga del DT.
async function fetchCardPool(leagueId = null, nationalityId = null) {
  let query = supabase.from('cards').select(COLUMNAS_CARTA).eq('is_active', true);
  if (nationalityId) query = query.eq('nationality_id', nationalityId);
  else if (leagueId) query = query.eq('league_id', leagueId);

  const { data, error } = await query;

  if (error) throw new DataError(error.message, { causa: error });
  return data;
}

// Trae los ids de las cartas que el manager ya tiene, para no volver a
// dárselas si se simula la apertura de sobres más de una vez.
async function fetchOwnedCardIds(managerId) {
  const { data, error } = await supabase.from('user_cards').select('card_id').eq('manager_id', managerId);

  if (error) throw new DataError(error.message, { causa: error });
  return new Set(data.map((fila) => fila.card_id));
}

// Verifica que, después de sacar las cartas repetidas, todavía queden
// suficientes cartas por posición para cumplir los mínimos garantizados.
function verificarPoolAlcanza(pool) {
  const conteoPorPosicion = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
  for (const carta of pool) {
    if (conteoPorPosicion[carta.position] !== undefined) {
      conteoPorPosicion[carta.position] += 1;
    }
  }

  for (const [posicion, minimo] of Object.entries(MINIMOS_POR_POSICION)) {
    if (conteoPorPosicion[posicion] < minimo) {
      throw new DataError('No quedan suficientes cartas nuevas para armar un plantel.');
    }
  }
}

async function saveSquad(managerId, cards) {
  const filas = cards.map((carta) => ({
    manager_id: managerId,
    card_id: carta.id,
    acquired_via: 'pack',
  }));

  // Red de seguridad: si por una condición de carrera se intenta insertar
  // una carta que el manager ya tiene, la ignoramos en vez de romper todo
  // el insert con un error de constraint duplicada.
  const { error } = await supabase
    .from('user_cards')
    .upsert(filas, { onConflict: 'manager_id,card_id', ignoreDuplicates: true });
  if (error) throw new DataError(error.message, { causa: error });
}

// Arma y guarda el plantel inicial de un manager recién creado.
// Devuelve un array de 3 sobres, cada uno con 5 cartas completas
// (listas para dibujar en la pantalla de apertura).
//
// leagueId: slug de cards.league_id ('premier' | 'laliga' | 'seriea'). El
// pool se filtra a esa liga. Sin leagueId (panel de dev) se usa el catálogo
// completo, como antes.
//
// Guardamos las 15 cartas en la base ANTES de mostrar la animación, así
// el plantel queda persistido aunque el jugador cierre la pestaña a mitad
// de la apertura de sobres: la animación solo "reproduce" algo que ya
// está guardado, nunca al revés.
// Modo Draft Puro: devuelve `slots` grupos de `opcionesPorSlot` cartas cada uno
// para que el usuario elija 1 por grupo. NO guarda nada en user_cards — eso
// lo hace saveDraftChoices() cuando el usuario termina de elegir.
// Normaliza columnas DB al shape del motor/UI (mismo mapeo que cargarCartasDB en cartas.js).
function normalizarParaUI(c) {
  return {
    ...c,
    rating:      c.overall_rating ?? c.rating ?? 0,
    nombre:      c.name ?? c.nombre ?? '',
    pos:         c.position ?? c.pos ?? '',
    foto:        c.photo_url ?? c.foto ?? null,
    rareza:      c.rarity ?? c.rareza ?? 'bronce',
    ultimoDelta: 0,
  };
}

export async function openDraftPool(managerId, leagueId = null, slots = 15, opcionesPorSlot = 4, nationalityId = null) {
  const [pool, idsUsados] = await Promise.all([fetchCardPool(leagueId, nationalityId), fetchOwnedCardIds(managerId)]);
  const disponibles = pool.filter((c) => !idsUsados.has(c.id));
  // Fisher-Yates shuffle
  for (let i = disponibles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [disponibles[i], disponibles[j]] = [disponibles[j], disponibles[i]];
  }
  const grupos = [];
  for (let i = 0; i < slots; i++) {
    const opciones = disponibles.slice(i * opcionesPorSlot, (i + 1) * opcionesPorSlot);
    if (opciones.length >= opcionesPorSlot) grupos.push(opciones.map(normalizarParaUI));
  }
  return grupos;
}

// Modo Club Real: carga la plantilla oficial del club desde la DB y genera
// 1 sobre de 5 cartas de refuerzo de la misma liga.
// Devuelve { plantelNormalizado, sobreDB } donde:
//   plantelNormalizado: array de cartas listas para el motor (con rating, nombre, pos)
//   sobreDB: [[card1..card5]] en formato cartasInicialesDB para iniciarCarrera
export async function openClubRealSquad(managerId, clubName, leagueId) {
  // 1. Plantilla oficial del club (todas las cartas activas de ese club)
  const { data: clubCards, error } = await supabase
    .from('cards')
    .select(COLUMNAS_CARTA)
    .eq('is_active', true)
    .eq('club', clubName)
    .order('overall_rating', { ascending: false });
  if (error) throw new DataError(error.message, { causa: error });

  if (clubCards.length) await saveSquad(managerId, clubCards);

  // 2. Sobre de refuerzo: 5 cartas aleatorias de la liga (excluyendo las ya guardadas)
  const [pool, idsUsados] = await Promise.all([
    fetchCardPool(leagueId),
    fetchOwnedCardIds(managerId),
  ]);
  const poolNuevo = pool.filter((c) => !idsUsados.has(c.id));
  for (let i = poolNuevo.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [poolNuevo[i], poolNuevo[j]] = [poolNuevo[j], poolNuevo[i]];
  }
  const packCards = poolNuevo.slice(0, 5);
  if (packCards.length) await saveSquad(managerId, packCards);

  return {
    plantelNormalizado: clubCards.map(normalizarParaUI),
    sobreDB: packCards.length ? [packCards] : [],
  };
}

// Guarda las cartas elegidas en el draft al terminar de elegir las 15.
export async function saveDraftChoices(managerId, cardIds) {
  const filas = cardIds.map((card_id) => ({ manager_id: managerId, card_id, acquired_via: 'draft' }));
  const { error } = await supabase
    .from('user_cards')
    .upsert(filas, { onConflict: 'manager_id,card_id', ignoreDuplicates: true });
  if (error) throw new DataError(error.message, { causa: error });
}

export async function openInitialPacks(managerId, leagueId = null, nationalityId = null, ovrCap = 99) {
  const [pool, idsUsados] = await Promise.all([fetchCardPool(leagueId, nationalityId), fetchOwnedCardIds(managerId)]);

  // Filtramos las cartas que el manager ya tiene para que draftSquad no
  // vuelva a repartirlas (eso era lo que rompía el insert con el error de
  // constraint duplicada).
  const poolNuevo = pool
    .filter((carta) => !idsUsados.has(carta.id))
    .filter((carta) => carta.overall_rating <= ovrCap);
  verificarPoolAlcanza(poolNuevo);

  const plantel = draftSquad(poolNuevo);

  await saveSquad(managerId, plantel);

  return splitIntoPacks(plantel);
}
