// cardColors.js — colores de fondo de una carta según su BANDA de rating
// (BRONZE/SILVER/GOLD/SPECIAL, calculada por getTier() a partir de
// overall_rating). Antes esta paleta vivía duplicada en CardSprite.js y
// RevealCardSprite.js; ahora es un único lugar del que ambos importan, para
// que una misma carta se vea igual en las dos pantallas.
//
// Ojo: esto es independiente de la columna `cards.rarity`
// (comun/rara/epica/legendaria), que es un concepto totalmente distinto
// (probabilidad de drop en los sobres) — ver migrations/004_open_pack.sql.
import { getTier } from '../core/ratingTiers.js';
import { COLORS } from '../theme/tokens.js';

// Los números tipo 0xRRGGBB son la forma en que Phaser espera los colores
// (el mismo valor hexadecimal que usarías en CSS como "#A56A45", pero con
// 0x en vez de #). Los valores en sí salen de COLORS.tier en tokens.js,
// que es la fuente única de verdad de la paleta del juego.
export const COLORES_BANDA = {
  BRONZE: COLORS.tier.bronze,
  SILVER: COLORS.tier.silver,
  GOLD: COLORS.tier.gold,
  // "special" no es un color único: es un degradado violeta -> negro.
  // Guardamos los dos extremos del degradado para usarlos con fillGradientStyle.
  SPECIAL: { desde: COLORS.tier.special.from, hasta: COLORS.tier.special.to },
};

// colorDeCarta: dado el objeto jugador (mismo formato que la tabla `cards`),
// devuelve el color (o el degradado, si es SPECIAL) que le corresponde según
// su overall_rating. Este es el único lugar que debería decidir de qué color
// se pinta una carta: nadie debería volver a leer card.rarity para esto.
export function colorDeCarta(card) {
  const banda = getTier(card.overall_rating);
  return COLORES_BANDA[banda];
}
