import { createAvatar } from '@dicebear/core';
import { micah } from '@dicebear/collection';

export function generatePlayerAvatar(playerId) {
  const avatar = createAvatar(micah, {
    seed: String(playerId),
  });

  return avatar.toString();
}

export function generatePlayerAvatarDataURI(playerId) {
  const svg = generatePlayerAvatar(playerId);
  const encoded = encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22');

  return `data:image/svg+xml,${encoded}`;
}

// Clave de textura del avatar genérico de un jugador, para precargarlo con
// this.load.image(clave, generatePlayerAvatarDataURI(id)) y después
// chequear this.textures.exists(clave) al dibujar la carta (mismo patrón
// que claveFotoCarta/claveImagenCarta para la foto real).
export function claveAvatarGenerico(playerId) {
  return `avatar-generico-${playerId}`;
}
