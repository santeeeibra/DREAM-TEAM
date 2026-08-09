// cardImage.js — resuelve qué imagen mostrar en la carta de un jugador.
//
// La migración ya dejó todas las cartas con su foto real en `photo_url`
// (imágenes alojadas en nuestro bucket) y `uses_generated_avatar = false`,
// así que esta función es lo más tonta y directa posible:
//
//   1. photo_url: si la carta tiene una foto, la usamos tal cual.
//   2. Fallback: si por alguna razón la carta llegó sin photo_url (ej. los
//      que quedaron como "sin resultado" en el scraper), devolvemos el
//      avatar de iniciales que ya usa el proyecto.
//
// No hay más peticiones a dominios externos en tiempo de ejecución: toda
// la lógica vieja de fut_id / CDN de fut.gg / IDs de Sofifa se eliminó.

import { generateInitialsAvatarDataURI } from './initialsAvatar.js';

// Devuelve la URL de imagen que debe usarse para la carta. Nunca devuelve
// null: si no hay photo_url, cae al avatar de iniciales del jugador.
export function resolveCardImageUrl(card) {
  if (card.photo_url) return card.photo_url;
  return generateInitialsAvatarDataURI(card.name, card.overall_rating);
}
