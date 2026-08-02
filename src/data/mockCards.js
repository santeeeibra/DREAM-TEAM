// mockCards.js — datos de prueba (mock) para poder diseñar y probar las cartas
// sin necesidad de tener la base de datos de Supabase conectada todavía.
// Cuando conectemos Supabase de verdad, las filas de la tabla `cards` van a
// tener esta misma forma (mismos nombres de campo), así que este array sirve
// como "maqueta" fiel de lo que vamos a recibir.

// Esta función recibe el overall_rating (el puntaje general del jugador)
// y devuelve a qué "rareza" pertenece la carta, según el rango en el que caiga.
// La usamos para no tener que escribir la rareza a mano en cada jugador de mockCards.
function getRarityFromRating(rating) {
  if (rating >= 85) return 'special'; // 85 en adelante -> carta especial (la más rara)
  if (rating >= 75) return 'gold'; // 75 a 84 -> carta dorada
  if (rating >= 60) return 'silver'; // 60 a 74 -> carta plateada
  return 'bronze'; // 40 a 59 -> carta de bronce
}

// Lista base de jugadores de prueba. Todavía no tienen el campo `rarity`:
// se lo agregamos abajo automáticamente a partir de overall_rating, para
// evitar el error de poner un rating y una rareza que no coincidan.
const jugadoresBase = [
  { id: 1, name: 'Alex Rivera', position: 'ARQ', club: 'River Dream FC', nationality: 'Argentina', overall_rating: 88 },
  { id: 2, name: 'Bruno Souza', position: 'DEF', club: 'Santos United', nationality: 'Brasil', overall_rating: 79 },
  { id: 3, name: 'Carlos Núñez', position: 'DEF', club: 'Boca Dream', nationality: 'Argentina', overall_rating: 65 },
  { id: 4, name: 'Diego Fernández', position: 'MC', club: 'Racing Stars', nationality: 'Uruguay', overall_rating: 72 },
  { id: 5, name: 'Ezequiel Gómez', position: 'DEL', club: 'Independiente FC', nationality: 'Argentina', overall_rating: 91 },
  { id: 6, name: 'Franco Rossi', position: 'DEL', club: 'Milan Dream', nationality: 'Italia', overall_rating: 58 },
  { id: 7, name: 'Gabriel Ortiz', position: 'MC', club: 'Vélez Dream', nationality: 'Argentina', overall_rating: 76 },
  { id: 8, name: 'Hugo Martins', position: 'ARQ', club: 'Porto United', nationality: 'Portugal', overall_rating: 61 },
  { id: 9, name: 'Iván Castro', position: 'DEF', club: 'Colo-Colo FC', nationality: 'Chile', overall_rating: 45 },
  { id: 10, name: 'Julián Pérez', position: 'DEL', club: 'Newells Dream', nationality: 'Argentina', overall_rating: 83 },
  { id: 11, name: 'Kevin Duarte', position: 'MC', club: 'Barcelona Dream', nationality: 'Paraguay', overall_rating: 68 },
  { id: 12, name: 'Lucas Herrera', position: 'DEF', club: 'PSG United', nationality: 'Francia', overall_rating: 55 },
];

// export const mockCards: es la lista final que vamos a importar en otros archivos
// (CardSprite.js y CollectionScene.js). Usamos .map() para recorrer cada jugador
// de jugadoresBase y devolver un objeto nuevo, igual pero con el campo `rarity` agregado.
export const mockCards = jugadoresBase.map((jugador) => ({
  ...jugador, // "spread": copia todos los campos que ya tenía el jugador (id, name, etc)
  rarity: getRarityFromRating(jugador.overall_rating), // le sumamos el campo rarity calculado
}));
