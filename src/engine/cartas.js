// PURA. La generación de cartas y apertura de sobres ahora vive en Supabase (open_pack).
// Este módulo formatea lo que viene de la DB y maneja la progresión de las cartas.
import { PROGRESION } from './balance.js';

/** Recibe el array de cartas que tu API ya trajo de Supabase */
export function cargarCartasDB(cartasDB) {
  return cartasDB.map((c) => ({
    id: c.id,
    fut_id: c.fut_id, // Link a fut.gg
    nombre: c.nombre || c.name || c.player_name || 'Jugador', // O el mapeo que uses de la API de FPL
    pos: c.pos || c.position,
    rating: c.overall_rating,
    rareza: c.rarity,
    league_id: c.league_id,
    edad: c.date_of_birth ? Math.floor((Date.now() - new Date(c.date_of_birth).getTime()) / 31557600000) : (c.edad || 24),
    foto: c.photo_url || c.foto || null,
    ultimoDelta: 0
  }));
}

export function envejecerPlantel(rng, plantel) {
  return plantel.map((c) => {
    const edad = c.edad + 1;
    let delta;
    if (edad <= PROGRESION.JOVEN) delta = rng.int(...PROGRESION.SUBIDA);
    else if (edad >= PROGRESION.VETERANO) delta = -rng.int(...PROGRESION.BAJADA);
    else delta = rng.int(...PROGRESION.MESETA);
    return { ...c, edad, rating: Math.max(45, Math.min(94, c.rating + delta)), ultimoDelta: delta };
  });
}

export function valorDeVenta(carta) {
  const base = Math.max(0, carta.rating - 55);
  // Ajustado a las 4 rarezas reales que tenés en Supabase
  const mult = { bronce: 0.12, oro_comun: 0.25, oro_unico: 0.35, epica: 0.6 }[carta.rareza] || 0.12;
  return Math.round(base * base * mult * 10) / 100;
}