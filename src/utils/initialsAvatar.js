// initialsAvatar.js — genera un avatar SVG con las iniciales del jugador
// sobre el color de su banda de rating. Es el fallback cuando la foto de
// fut.gg no carga (CDN caído, 404, o jugador sin fut_id asignado).
//
// Reemplaza a avatarGenerator.js (Dicebear): en vez de una carita de
// dibujito genérica, muestra algo que identifica al jugador y respeta
// la identidad visual de la carta.

import { getTier } from '../core/ratingTiers.js';

// Mismos colores que COLORES_BANDA en CardSprite.js, pero como strings CSS.
// OJO: no se pueden reutilizar los de allá tal cual — Phaser usa números
// (0xa56a45) y el SVG necesita strings con numeral ('#a56a45').
const COLORES_BANDA_CSS = {
  BRONZE: '#a56a45',
  SILVER: '#9fb4c7',
  GOLD: '#d4af37',
  SPECIAL: { desde: '#6a0dad', hasta: '#000000' },
};

const TAMANIO = 250; // mismo tamaño que las fotos reales (WebP 250x250)

// Clave de textura del avatar de iniciales, para precargarlo con
// this.load.image(clave, dataURI) y después chequear
// this.scene.textures.exists(clave) al dibujar la carta.
export function claveAvatarIniciales(cardId) {
  return `avatar-iniciales-${cardId}`;
}

// Reglas: primera letra de la primera palabra + primera letra de la
// última. Un solo nombre -> sus dos primeras letras. Sin nombre -> '?'.
export function getIniciales(name) {
  if (!name || typeof name !== 'string') return '?';

  // filter(Boolean) descarta strings vacíos por si el nombre tiene
  // espacios dobles ("Kevin  De Bruyne" -> ['Kevin','De','Bruyne']).
  const palabras = name.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '?';

  if (palabras.length === 1) {
    return palabras[0].slice(0, 2).toUpperCase();
  }

  const primera = palabras[0][0];
  const ultima = palabras[palabras.length - 1][0];
  return (primera + ultima).toUpperCase();
}

function construirSVG(iniciales, banda) {
  const color = COLORES_BANDA_CSS[banda] ?? COLORES_BANDA_CSS.BRONZE;
  const esEspecial = banda === 'SPECIAL';

  // El degradado necesita definirse en un <defs> y referenciarse por id.
  // Como cada avatar es un documento SVG independiente (data URI aparte),
  // el id fijo 'grad' no colisiona entre cartas.
  const defs = esEspecial
    ? `<defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="${color.desde}"/>` +
      `<stop offset="100%" stop-color="${color.hasta}"/>` +
      `</linearGradient></defs>`
    : '';

  const relleno = esEspecial ? 'url(#grad)' : color;

  // text-anchor="middle" centra horizontalmente respecto de x;
  // dominant-baseline="central" hace lo mismo en vertical respecto de y.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TAMANIO}" height="${TAMANIO}" viewBox="0 0 ${TAMANIO} ${TAMANIO}">` +
    defs +
    `<rect width="${TAMANIO}" height="${TAMANIO}" fill="${relleno}"/>` +
    `<text x="${TAMANIO / 2}" y="${TAMANIO / 2}" ` +
    `font-family="Arial, Helvetica, sans-serif" font-size="110" font-weight="bold" ` +
    `fill="#ffffff" text-anchor="middle" dominant-baseline="central">${iniciales}</text>` +
    `</svg>`
  );
}

export function generateInitialsAvatarDataURI(name, overallRating) {
  const iniciales = getIniciales(name);
  const banda = getTier(overallRating ?? 65); // sin rating -> banda más baja
  const svg = construirSVG(iniciales, banda);

  const encoded = encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
}