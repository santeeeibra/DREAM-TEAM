// careerTimeline.js — transformación de datos pura para la línea de tiempo
// de la carrera (CareerSummary). No toca Supabase ni Phaser: recibe las
// filas de la tabla `seasons` y devuelve un array plano de temporadas listo
// para que la UI las dibuje. Toda la lógica de estado (done/current/future)
// y de mapeo de columnas vive acá, aislada de la escena.

// buildTimelineRows arma la línea de tiempo completa de la carrera:
//   - Las temporadas ya jugadas (season_number < currentSeasonNumber) salen
//     con state 'done' y sus datos reales.
//   - La temporada en curso (season_number === currentSeasonNumber) sale con
//     state 'current'.
//   - Las temporadas futuras (desde currentSeasonNumber + 1 hasta
//     totalSeasons) se devuelven igual pero vacías, con state 'future' y
//     clubName null, para que la UI las dibuje atenuadas con un placeholder.
export function buildTimelineRows(seasons, currentSeasonNumber, totalSeasons) {
  // Mapa temporada -> fila para resolver rápido por season_number en vez de
  // buscar en el array a cada iteración.
  const porNumero = new Map(seasons.map((fila) => [fila.season_number, fila]));

  const filas = [];

  // Recorremos de la temporada 1 hasta totalSeasons inclusive, así la UI
  // siempre recibe un array completo y ordenado sin tener que rellenar nada.
  for (let seasonNumber = 1; seasonNumber <= totalSeasons; seasonNumber++) {
    const fila = porNumero.get(seasonNumber);

    // Temporadas futuras: siempre vacías, sin importar si existe una fila
    // (no debería, pero por robustez no mostramos datos de una temporada
    // que todavía no se jugó). La UI las dibuja atenuadas con placeholder.
    if (seasonNumber > currentSeasonNumber) {
      filas.push({
        seasonNumber,
        year: null,
        clubName: null,
        rating: null,
        played: null,
        won: null,
        drawn: null,
        lost: null,
        trophies: null,
        badge: null,
        state: 'future',
      });
      continue;
    }

    // done (ya jugada) o current (en curso), según el número de temporada
    // respecto de la actual. Los datos vienen de la fila si existe; si no
    // (inconsistencia de datos), se rellenan con null sin romper la UI.
    const state = seasonNumber < currentSeasonNumber ? 'done' : 'current';

    filas.push({
      seasonNumber,
      year: fila?.season_year ?? null,
      clubName: fila?.club_name ?? null,
      rating: fila?.rating ?? null,
      played: fila?.played ?? null,
      won: fila?.wins ?? null,
      drawn: fila?.draws ?? null,
      lost: fila?.losses ?? null,
      trophies: fila?.trophies ?? null,
      badge: fila?.badge ?? null,
      state,
    });
  }

  return filas;
}