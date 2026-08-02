// cardImage.js — resuelve qué imagen mostrar en la carta de un jugador,
// con la prioridad correcta:
//
//   1. fut_id: si el jugador tiene un fut_id asignado, usamos su imagen
//      oficial de EA/fut.gg desde el CDN (https://cdn.fut.gg/cards/26/p{id}.png).
//   2. photo_url: si no tiene fut_id pero tiene photo_url y
//      uses_generated_avatar es false, usamos la foto vieja.
//   3. Fallback: null (las escenas caen al avatar de iniciales).
//
// Esta función es la ÚNICA fuente de verdad para decidir qué imagen
// precargar en cada escena (CollectionScene, PackOpeningScene, LineupScene).

// URL base del CDN de fut.gg para las cartas de FC 26 (temporada 26).
const CDN_FUT_GG_BASE = 'https://cdn.fut.gg/cards/26/p';

// Devuelve la URL de la imagen oficial de fut.gg para un fut_id, o null
// si el jugador no tiene fut_id asignado.
export function futGgImageUrl(futId) {
  if (futId == null || futId === '') return null;
  return `${CDN_FUT_GG_BASE}${futId}.png`;
}

// Devuelve la URL de imagen que debe usarse para la carta, siguiendo la
// prioridad documentada arriba. Devuelve null si no hay ninguna imagen
// real que mostrar (en ese caso la escena usa el avatar de iniciales).
export function resolveCardImageUrl(card) {
  // Prioridad 1: fut_id → imagen oficial de EA/fut.gg.
  const futUrl = futGgImageUrl(card.fut_id);
  if (futUrl) return futUrl;

  // Prioridad 2: photo_url viejo, solo si no se pidió explícitamente usar
  // el avatar generado.
  if (card.photo_url && card.uses_generated_avatar !== true) {
    return card.photo_url;
  }

  // Fallback: sin foto real → null (avatar de iniciales).
  return null;
}