// lineups.js — todo lo relacionado a guardar y armar el 11 titular de un
// manager. Es lógica de datos (habla con Supabase y con las formaciones del
// motor de partido), sin nada de Phaser ni de pantalla: eso vive en
// src/scenes/LineupScene.js, que usa estas funciones.
import { supabase } from './supabaseClient.js';
import { FORMATIONS } from './engine/formations.js';

const POSICIONES = ['POR', 'DEF', 'MED', 'DEL'];

// positionCountsForFormation traduce una clave de FORMATIONS (ej. "4-4-2")
// a cuántos jugadores de cada posición tiene esa formación en cancha.
// Los números salen de parsear la propia clave (4 DEF, 4 MED, 2 DEL) más 1
// arquero fijo, en vez de escribirlos de nuevo acá: así esta función y
// formations.js nunca pueden quedar desincronizados sobre qué es un "4-4-2".
export function positionCountsForFormation(formationKey) {
  const [def, med, del] = formationKey.split('-').map(Number);
  return { POR: 1, DEF: def, MED: med, DEL: del };
}

// countByPosition cuenta cuántas cartas de cada posición hay en una lista.
// Exportada porque LineupScene también la necesita para el contador en vivo
// (POR 1/1 · DEF 3/4 · ...) y para saber si una posición ya está completa.
export function countByPosition(cards) {
  const conteo = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
  for (const carta of cards) {
    if (conteo[carta.position] !== undefined) conteo[carta.position] += 1;
  }
  return conteo;
}

// formationFit compara las cartas seleccionadas contra los puestos de UNA
// formación puntual. Devuelve:
//   - totalDiff: cuán lejos está esa formación de calzar perfecto (0 = calza).
//   - faltan: posiciones donde seleccionaste MENOS jugadores de los que pide
//     la formación (ej. { DEF: 1 } = te falta 1 defensor).
//   - sobran: posiciones donde seleccionaste MÁS de los que pide (ej. { MED: 2 }).
export function formationFit(selectedCards, formationKey) {
  const requeridos = positionCountsForFormation(formationKey);
  const seleccionados = countByPosition(selectedCards);

  let totalDiff = 0;
  const faltan = {};
  const sobran = {};

  for (const posicion of POSICIONES) {
    const diferencia = seleccionados[posicion] - requeridos[posicion];
    totalDiff += Math.abs(diferencia);
    if (diferencia < 0) faltan[posicion] = -diferencia;
    if (diferencia > 0) sobran[posicion] = diferencia;
  }

  return { formation: formationKey, totalDiff, exact: totalDiff === 0, faltan, sobran };
}

// detectBestFormation prueba las 4 formaciones de FORMATIONS (importadas de
// formations.js, para no duplicar esa lista acá) y devuelve la que menos
// diferencia total tiene contra las cartas seleccionadas. En caso de empate,
// gana la primera en el orden de FORMATIONS (4-4-2). Si no hay un match
// exacto, el resultado igual trae `faltan`/`sobran` para esa formación.
export function detectBestFormation(selectedCards) {
  const opciones = Object.keys(FORMATIONS).map((clave) => formationFit(selectedCards, clave));
  return opciones.reduce((mejor, actual) => (actual.totalDiff < mejor.totalDiff ? actual : mejor));
}

// formacionSugeridaPorDefensores mira cuántos defensores lleva elegidos el
// usuario y devuelve la formación de FORMATIONS cuyo requisito de DEF
// coincide exacto con esa cantidad (ej: 5 defensores -> "5-3-2"). Si esa
// cantidad no identifica una única formación estándar (0 formaciones piden
// esa cantidad, o hay más de una que la pide — como 4, que sirve tanto para
// 4-4-2 como para 4-3-3), devuelve null: en ese caso LineupScene no toca la
// formación elegida y deja la selección manual como estaba.
export function formacionSugeridaPorDefensores(cantidadDef) {
  const coincidencias = Object.keys(FORMATIONS).filter(
    (clave) => positionCountsForFormation(clave).DEF === cantidadDef
  );
  return coincidencias.length === 1 ? coincidencias[0] : null;
}

// resolveSeasonNumber devuelve seasonNumber tal cual si vino explícito, o
// si no, el current_season vigente del manager (tabla `managers`, Fase 4 ya
// implementada). lineups.season_number es NOT NULL en la base, así que acá
// siempre hace falta resolver un valor concreto antes de leer/escribir.
async function resolveSeasonNumber(managerId, seasonNumber) {
  if (seasonNumber != null) return seasonNumber;

  const { data, error } = await supabase
    .from('managers')
    .select('current_season')
    .eq('id', managerId)
    .single();
  if (error) throw error;
  return data.current_season;
}

// getLineup trae el lineup guardado de un manager para una temporada.
// seasonNumber es opcional: si no se pasa, se usa la temporada actual del
// manager. Devuelve null si nunca guardó ninguno para esa temporada.
export async function getLineup(managerId, seasonNumber = null) {
  const season = await resolveSeasonNumber(managerId, seasonNumber);

  const { data, error } = await supabase
    .from('lineups')
    .select('*')
    .eq('manager_id', managerId)
    .eq('season_number', season)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// saveLineup guarda el 11 titular de un manager, o lo actualiza si ya había
// uno guardado para ese manager/temporada. `slots` tiene esta forma:
//   { formation: '4-4-2', starters: [{ slot: 'GK', card_id: '...' }, ...], bench: ['card_id', ...] }
//
// Hacemos el "upsert" a mano (primero buscamos si ya existe, después
// insert o update según corresponda) en vez de depender de una unique
// constraint en la base sobre (manager_id, season_number).
export async function saveLineup(managerId, seasonNumber, formation, slots) {
  const season = await resolveSeasonNumber(managerId, seasonNumber);
  const existente = await getLineup(managerId, season);

  const fila = {
    manager_id: managerId,
    season_number: season,
    formation,
    slots,
  };

  if (existente) {
    const { data, error } = await supabase
      .from('lineups')
      .update({ ...fila, updated_at: new Date().toISOString() })
      .eq('id', existente.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.from('lineups').insert(fila).select().single();
  if (error) throw error;
  return data;
}

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
      'id, cards (id, name, club, position, overall_rating, rarity, photo_url, fut_id, uses_generated_avatar)'
    )
    .eq('manager_id', managerId);

  if (error) throw error;

  return data.map((fila) => ({
    ...fila.cards,
    user_card_id: fila.id,
  }));
}
