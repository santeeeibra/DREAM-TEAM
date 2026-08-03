// ratingTiers.js — bandas de rareza visual (Bronze/Silver/Gold/Special) en
// base al overall_rating de una carta. Es la MISMA lógica que
// scripts/seed-players.js (que reexporta desde acá para no duplicarla):
// se separa a un módulo sin dependencias de Node (fs/dotenv) para que
// también lo pueda importar el código de cliente (Phaser/CardSprite).
export const RATING_TIERS = {
  BRONZE: { min: 65, max: 72 },
  SILVER: { min: 73, max: 78 },
  GOLD: { min: 79, max: 85 },
  SPECIAL: { min: 86, max: 92 },
};

export function getTier(rating) {
  if (rating <= RATING_TIERS.BRONZE.max) return 'BRONZE';
  if (rating <= RATING_TIERS.SILVER.max) return 'SILVER';
  if (rating <= RATING_TIERS.GOLD.max) return 'GOLD';
  return 'SPECIAL';
}
