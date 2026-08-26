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
      { id: 'inter', name: 'Inter' },
      { id: 'milan', name: 'AC Milan' },
      { id: 'parma', name: 'Parma' },
      { id: 'pisa', name: 'Pisa' },
      { id: 'napoli', name: 'SSC Napoli' },
      { id: 'sassuolo', name: 'Sassuolo' },
      { id: 'torino', name: 'Torino' },
      { id: 'udinese', name: 'Udinese' },
    ],
  },
  // --- Bundesliga ---
  // Licencia EA completa → nombres reales. Clubs = temporada 2025-26 de FC26.
  // Verificar con: node scripts/import-futgg-league.mjs bundesliga --dry-run
  {
    id: 'bundesliga',
    league: 'Bundesliga',
    country: 'Alemania',
    clubs: [
      { id: 'bayern',       name: 'Bayern München' },
      { id: 'dortmund',     name: 'Borussia Dortmund' },
      { id: 'leverkusen',   name: 'Bayer Leverkusen' },
      { id: 'leipzig',      name: 'RB Leipzig' },
      { id: 'gladbach',     name: "B. M'gladbach" },
      { id: 'frankfurt',    name: 'E. Frankfurt' },
      { id: 'wolfsburg',    name: 'VfL Wolfsburg' },
      { id: 'freiburg',     name: 'SC Freiburg' },
      { id: 'union-berlin', name: 'Union Berlin' },
      { id: 'stuttgart',    name: 'VfB Stuttgart' },
      { id: 'werder',       name: 'Werder Bremen' },
      { id: 'heidenheim',   name: '1. FC Heidenheim' },
      { id: 'augsburg',     name: 'FC Augsburg' },
      { id: 'hoffenheim',   name: 'TSG Hoffenheim' },
      { id: 'mainz',        name: '1. FSV Mainz 05' },
      { id: 'st-pauli',     name: 'FC St. Pauli' },
      { id: 'hsv',          name: 'Hamburger SV' },
      { id: 'hannover',     name: 'Hannover 96' },
    ],
  },

  // --- MLS ---
  // Licencia EA completa → nombres reales. Verificar con:
  // node scripts/import-futgg-league.mjs mls --dry-run
  {
    id: 'mls',
    league: 'MLS',
    country: 'Estados Unidos',
    clubs: [
      { id: 'inter-miami',   name: 'Inter Miami CF' },
      { id: 'lagalaxy',      name: 'LA Galaxy' },
      { id: 'lafc',          name: 'LAFC' },
      { id: 'seattle',       name: 'Seattle Sounders FC' },
      { id: 'portland',      name: 'Portland Timbers' },
      { id: 'atlanta',       name: 'Atlanta United FC' },
      { id: 'nycfc',         name: 'New York City FC' },
      { id: 'nyrb',          name: 'New York Red Bulls' },
      { id: 'revolution',    name: 'New England Revolution' },
      { id: 'phila',         name: 'Philadelphia Union' },
      { id: 'colorado',      name: 'Colorado Rapids' },
      { id: 'fc-dallas',     name: 'FC Dallas' },
      { id: 'chicago',       name: 'Chicago Fire FC' },
      { id: 'columbus',      name: 'Columbus Crew' },
      { id: 'houston',       name: 'Houston Dynamo FC' },
      { id: 'sporting-kc',   name: 'Sporting Kansas City' },
      { id: 'minnesota',     name: 'Minnesota United FC' },
      { id: 'toronto',       name: 'Toronto FC' },
      { id: 'vancouver',     name: 'Vancouver Whitecaps FC' },
      { id: 'real-salt-lake',name: 'Real Salt Lake' },
      { id: 'sanjose',       name: 'San Jose Earthquakes' },
      { id: 'dc-united',     name: 'D.C. United' },
      { id: 'austin',        name: 'Austin FC' },
      { id: 'charlotte',     name: 'Charlotte FC' },
      { id: 'nashville',     name: 'Nashville SC' },
      { id: 'stlouis',       name: 'St. Louis City SC' },
      { id: 'montreal',      name: 'CF Montréal' },
      { id: 'orlando',       name: 'Orlando City SC' },
      { id: 'cincinnati',    name: 'FC Cincinnati' },
      { id: 'sandiego',      name: 'San Diego FC' },
    ],
  },
  // --- Ligue 1 ---
  // Licencia EA → nombres reales. Clubs = temporada 2025-26.
  // Verificar con: node scripts/import-futgg-league.mjs ligue1 --dry-run
  {
    id: 'ligue1',
    league: 'Ligue 1',
    country: 'Francia',
    clubs: [
      { id: 'psg',         name: 'Paris SG' },
      { id: 'monaco',      name: 'Monaco' },
      { id: 'marseille',   name: 'Marseille' },
      { id: 'lyon',        name: 'Lyon' },
      { id: 'lille',       name: 'Lille' },
      { id: 'nice',        name: 'Nice' },
      { id: 'lens',        name: 'Lens' },
      { id: 'rennes',      name: 'Rennes' },
      { id: 'strasbourg',  name: 'Strasbourg' },
      { id: 'reims',       name: 'Reims' },
      { id: 'toulouse',    name: 'Toulouse' },
      { id: 'nantes',      name: 'Nantes' },
      { id: 'brest',       name: 'Brest' },
      { id: 'montpellier', name: 'Montpellier' },
      { id: 'le-havre',    name: 'Le Havre' },
      { id: 'saint-etienne', name: 'Saint-Étienne' },
      { id: 'angers',      name: 'Angers' },
      { id: 'auxerre',     name: 'Auxerre' },
      { id: 'metz',        name: 'Metz' },
      { id: 'lorient',     name: 'Lorient' },
    ],
  },
  // --- Liga Profesional Argentina ---
  // Formato especial: 30 equipos en 2 zonas, fase regular de 16 fechas + play-offs
  {
    id: 'ligapro',
    league: 'Liga Profesional',
    country: 'Argentina',
    tienePlayoffs: true,
    equiposPorZona: 15,
    faseRegularMatchdays: 16,
    clasificadosPorZona: 8,
    clubs: [
      // Zona A (15 equipos)
      { id: 'racing', name: 'Racing Club', zona: 'A' },
      { id: 'river', name: 'River Plate', zona: 'A' },
      { id: 'san-lorenzo', name: 'San Lorenzo', zona: 'A' },
      { id: 'huracan', name: 'Huracán', zona: 'A' },
      { id: 'independiente', name: 'Independiente', zona: 'A' },
      { id: 'lanus', name: 'Lanús', zona: 'A' },
      { id: 'tigre', name: 'Tigre', zona: 'A' },
      { id: 'platense', name: 'Platense', zona: 'A' },
      { id: 'instituto', name: 'Instituto', zona: 'A' },
      { id: 'belgrano', name: 'Belgrano', zona: 'A' },
      { id: 'talleres', name: 'Talleres', zona: 'A' },
      { id: 'central-cordoba', name: 'Central Córdoba', zona: 'A' },
      { id: 'gimnasia', name: 'Gimnasia LP', zona: 'A' },
      { id: 'union', name: 'Unión', zona: 'A' },
      { id: 'sarmiento', name: 'Sarmiento', zona: 'A' },
      // Zona B (15 equipos)
      { id: 'boca', name: 'Boca Juniors', zona: 'B' },
      { id: 'estudiantes', name: 'Estudiantes LP', zona: 'B' },
      { id: 'velez', name: 'Vélez Sarsfield', zona: 'B' },
      { id: 'argentinos', name: 'Argentinos Juniors', zona: 'B' },
      { id: 'defensa', name: 'Defensa y Justicia', zona: 'B' },
      { id: 'banfield', name: 'Banfield', zona: 'B' },
      { id: 'arsenal', name: 'Arsenal de Sarandí', zona: 'B' },
      { id: 'colon', name: 'Colón', zona: 'B' },
      { id: 'rosario-central', name: 'Rosario Central', zona: 'B' },
      { id: 'newells', name: "Newell's", zona: 'B' },
      { id: 'godoy-cruz', name: 'Godoy Cruz', zona: 'B' },
      { id: 'independiente-rv', name: 'Independiente Rivadavia', zona: 'B' },
      { id: 'barracas', name: 'Barracas Central', zona: 'B' },
      { id: 'deportivo-riestra', name: 'Deportivo Riestra', zona: 'B' },
      { id: 'atletico-tucuman', name: 'Atlético Tucumán', zona: 'B' },
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