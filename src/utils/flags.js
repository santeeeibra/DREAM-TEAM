// Mapeo de región FPL -> código ISO 3166-1 alpha-2 (se completa en el seed)
export const fplRegionToISO = {};

export function getFlagClass(isoCode) {
  return `fi fi-${isoCode.toLowerCase()}`;
}
