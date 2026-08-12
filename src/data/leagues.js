// leagues.js — las 3 ligas del juego, alineadas con la tabla `cards` de
// Supabase (la fuente de verdad del draft). Recorte acordado: Premier,
// LaLiga y Serie A, 20 clubes cada una.
//
// CRÍTICO: los `name` de cada club son EXACTAMENTE los valores de la columna
// `club` en `cards`. El draft filtra el pool por league_id y la carta muestra
// el nombre del club; el motor arma los 19 rivales desde esta lista y excluye
// al club del DT por id/`name`. Si un nombre diverge de `cards`, el draft
// mezcla clubes que no existen (o rivales duplicados).
//
// Nota de contexto: las plantillas de `cards` son de FC24 con nombres EA de
// fantasía (Man City, Spurs, Nott'm Forest; Bergamo Calcio, Latium, Lombardia
// FC, Milano FC; D. Alavés, R. Oviedo, Levante UD...). Son los nombres que ve
// el jugador en el draft y en la tabla; `escudoteca.js` ya tiene aliases para
// resolverles el escudo real.
//
// Cada liga y club tiene un `id` (slug estable). Esos ids son los que se
// persisten en la tabla `managers` (columnas league_id / club_id; el league_id
// coincide con la columna `league_id` de `cards`) y los que consumen el motor
// (tier por club_id) y la UI (dropdown de clubes).

export const leagues = [
  {
    id: 'premier',
    league: 'Premier League',
    country: 'Inglaterra',
    clubs: [
      { id: 'arsenal', name: 'Arsenal' },
      { id: 'aston-villa', name: 'Aston Villa' },
      { id: 'bournemouth', name: 'Bournemouth' },
      { id: 'brentford', name: 'Brentford' },
      { id: 'brighton', name: 'Brighton' },
      { id: 'chelsea', name: 'Chelsea' },
      { id: 'coventry', name: 'Coventry City' },
      { id: 'crystal-palace', name: 'Crystal Palace' },
      { id: 'everton', name: 'Everton' },
      { id: 'fulham', name: 'Fulham' },
      { id: 'hull', name: 'Hull City' },
      { id: 'ipswich', name: 'Ipswich Town' },
      { id: 'leeds', name: 'Leeds' },
      { id: 'liverpool', name: 'Liverpool' },
      { id: 'man-city', name: 'Man City' },
      { id: 'man-utd', name: 'Man Utd' },
      { id: 'newcastle', name: 'Newcastle' },
      { id: 'nottingham-forest', name: "Nott'm Forest" },
      { id: 'tottenham', name: 'Spurs' },
      { id: 'sunderland', name: 'Sunderland' },
    ],
  },
  {
    id: 'laliga',
    league: 'LaLiga',
    country: 'España',
    clubs: [
      { id: 'athletic', name: 'Athletic Club' },
      { id: 'atletico-madrid', name: 'Atlético de Madrid' },
      { id: 'osasuna', name: 'CA Osasuna' },
      { id: 'alaves', name: 'D. Alavés' },
      { id: 'elche', name: 'Elche CF' },
      { id: 'barcelona', name: 'FC Barcelona' },
      { id: 'getafe', name: 'Getafe CF' },
      { id: 'girona', name: 'Girona FC' },
      { id: 'levante', name: 'Levante UD' },
      { id: 'real-oviedo', name: 'R. Oviedo' },
      { id: 'celta-vigo', name: 'RC Celta' },
      { id: 'espanyol', name: 'RCD Espanyol' },
      { id: 'mallorca', name: 'RCD Mallorca' },
      { id: 'rayo-vallecano', name: 'Rayo Vallecano' },
      { id: 'real-betis', name: 'Real Betis' },
      { id: 'real-madrid', name: 'Real Madrid' },
      { id: 'real-sociedad', name: 'Real Sociedad' },
      { id: 'sevilla', name: 'Sevilla FC' },
      { id: 'valencia', name: 'Valencia CF' },
      { id: 'villarreal', name: 'Villarreal CF' },
    ],
  },
  {
    id: 'seriea',
    league: 'Serie A',
    country: 'Italia',
    clubs: [
      { id: 'roma', name: 'AS Roma' },
      { id: 'atalanta', name: 'Bergamo Calcio' },
      { id: 'bologna', name: 'Bologna' },
      { id: 'cagliari', name: 'Cagliari' },
      { id: 'como', name: 'Como' },
      { id: 'cremonese', name: 'Cremonese' },
      { id: 'fiorentina', name: 'Fiorentina' },
      { id: 'genoa', name: 'Genoa' },
      { id: 'hellas-verona', name: 'Hellas Verona' },
      { id: 'juventus', name: 'Juventus' },
      { id: 'lazio', name: 'Latium' },
      { id: 'lecce', name: 'Lecce' },
      { id: 'inter', name: 'Lombardia FC' },
      { id: 'milan', name: 'Milano FC' },
      { id: 'parma', name: 'Parma' },
      { id: 'pisa', name: 'Pisa' },
      { id: 'napoli', name: 'SSC Napoli' },
      { id: 'sassuolo', name: 'Sassuolo' },
      { id: 'torino', name: 'Torino' },
      { id: 'udinese', name: 'Udinese' },
    ],
  },
];

// --- Helpers de lookup ---------------------------------------------------
// El resto del juego (motor, main.js, escenas) usa estos helpers en vez de
// recorrer `leagues` a mano, para que el lookup por id (nuevo, persistido en
// `managers`) o por nombre (legacy) esté en un solo lugar.

export function getLeagueById(leagueId) {
  return leagues.find((l) => l.id === leagueId) ?? null;
}

export function getLeagueByClubName(clubName) {
  return leagues.find((l) => l.clubs.some((c) => c.name === clubName)) ?? null;
}

export function getClubById(leagueId, clubId) {
  const liga = getLeagueById(leagueId);
  return liga?.clubs.find((c) => c.id === clubId) ?? null;
}

// getClubByNameAndLeague devuelve el club con su `id` (nuevo) y su `name`
// a partir del nombre que viene seleccionado en el formulario (legacy, cuando
// el club venía de la tabla `clubs` con su nombre de temporada actual).
// Si el club no está en la liga indicada, devuelve null.
export function getClubByNameAndLeague(clubName, leagueName) {
  const liga = leagues.find((l) => l.league === leagueName);
  return liga?.clubs.find((c) => c.name === clubName) ?? null;
}

export function findClubIdByName(clubName) {
  const liga = getLeagueByClubName(clubName);
  return liga?.clubs.find((c) => c.name === clubName)?.id ?? null;
}