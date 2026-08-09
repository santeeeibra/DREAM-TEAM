// leagues.js — ligas y clubes disponibles para el formulario de creación
// de DT. El select de club se arma dinámicamente en main.js a partir de la
// liga elegida, buscando acá los clubes que le corresponden.
//
// Cada liga y cada club tiene un `id` (slug estable y legible, ej.
// 'premier-league' / 'arsenal'). Esos ids son los que se persisten en la
// tabla `managers` (columnas league_id / club_id) y los que consumen las
// escenas siguientes (SeasonScene, CareerSummaryScene, etc.) para resolver
// logos, escudos y datos del perfil sin depender del nombre exacto en
// español.

export const leagues = [
  {
    id: 'premier-league',
    league: 'Premier League',
    country: 'Inglaterra',
    clubs: [
      { id: 'arsenal', name: 'Arsenal' },
      { id: 'aston-villa', name: 'Aston Villa' },
      { id: 'bournemouth', name: 'Bournemouth' },
      { id: 'brentford', name: 'Brentford' },
      { id: 'brighton', name: 'Brighton & Hove Albion' },
      { id: 'burnley', name: 'Burnley' },
      { id: 'chelsea', name: 'Chelsea' },
      { id: 'crystal-palace', name: 'Crystal Palace' },
      { id: 'everton', name: 'Everton' },
      { id: 'fulham', name: 'Fulham' },
      { id: 'leeds-united', name: 'Leeds United' },
      { id: 'liverpool', name: 'Liverpool' },
      { id: 'manchester-city', name: 'Manchester City' },
      { id: 'manchester-united', name: 'Manchester United' },
      { id: 'newcastle', name: 'Newcastle United' },
      { id: 'nottingham-forest', name: 'Nottingham Forest' },
      { id: 'sunderland', name: 'Sunderland' },
      { id: 'tottenham', name: 'Tottenham Hotspur' },
      { id: 'west-ham', name: 'West Ham United' },
      { id: 'wolves', name: 'Wolverhampton Wanderers' },
    ],
  },
  {
    id: 'laliga',
    league: 'LaLiga',
    country: 'España',
    clubs: [
      { id: 'alaves', name: 'Alavés' },
      { id: 'athletic-bilbao', name: 'Athletic Club' },
      { id: 'atletico-madrid', name: 'Atlético de Madrid' },
      { id: 'barcelona', name: 'Barcelona' },
      { id: 'celta-vigo', name: 'Celta de Vigo' },
      { id: 'elche', name: 'Elche' },
      { id: 'espanyol', name: 'Espanyol' },
      { id: 'getafe', name: 'Getafe' },
      { id: 'girona', name: 'Girona' },
      { id: 'levante', name: 'Levante' },
      { id: 'mallorca', name: 'Mallorca' },
      { id: 'osasuna', name: 'Osasuna' },
      { id: 'rayo-vallecano', name: 'Rayo Vallecano' },
      { id: 'real-betis', name: 'Real Betis' },
      { id: 'real-madrid', name: 'Real Madrid' },
      { id: 'real-oviedo', name: 'Real Oviedo' },
      { id: 'real-sociedad', name: 'Real Sociedad' },
      { id: 'sevilla', name: 'Sevilla' },
      { id: 'valencia', name: 'Valencia' },
      { id: 'villarreal', name: 'Villarreal' },
    ],
  },
  {
    id: 'serie-a',
    league: 'Serie A',
    country: 'Italia',
    clubs: [
      { id: 'atalanta', name: 'Atalanta' },
      { id: 'bologna', name: 'Bologna' },
      { id: 'cagliari', name: 'Cagliari' },
      { id: 'como', name: 'Como' },
      { id: 'cremonese', name: 'Cremonese' },
      { id: 'fiorentina', name: 'Fiorentina' },
      { id: 'genoa', name: 'Genoa' },
      { id: 'hellas-verona', name: 'Hellas Verona' },
      { id: 'inter', name: 'Inter' },
      { id: 'juventus', name: 'Juventus' },
      { id: 'lazio', name: 'Lazio' },
      { id: 'lecce', name: 'Lecce' },
      { id: 'milan', name: 'Milan' },
      { id: 'napoli', name: 'Napoli' },
      { id: 'parma', name: 'Parma' },
      { id: 'pisa', name: 'Pisa' },
      { id: 'roma', name: 'Roma' },
      { id: 'sassuolo', name: 'Sassuolo' },
      { id: 'torino', name: 'Torino' },
      { id: 'udinese', name: 'Udinese' },
    ],
  },
  {
    id: 'bundesliga',
    league: 'Bundesliga',
    country: 'Alemania',
    clubs: [
      { id: 'bayer-leverkusen', name: 'Bayer Leverkusen' },
      { id: 'bayern-munich', name: 'Bayern Múnich' },
      { id: 'borussia-dortmund', name: 'Borussia Dortmund' },
      { id: 'borussia-mgladbach', name: 'Borussia Mönchengladbach' },
      { id: 'eintracht-frankfurt', name: 'Eintracht Frankfurt' },
      { id: 'augsburg', name: 'FC Augsburgo' },
      { id: 'heidenheim', name: 'FC Heidenheim' },
      { id: 'st-pauli', name: 'FC St. Pauli' },
      { id: 'hamburg', name: 'Hamburgo SV' },
      { id: 'rb-leipzig', name: 'RB Leipzig' },
      { id: 'freiburg', name: 'SC Friburgo' },
      { id: 'hoffenheim', name: 'TSG Hoffenheim' },
      { id: 'union-berlin', name: 'Union Berlin' },
      { id: 'stuttgart', name: 'VfB Stuttgart' },
      { id: 'wolfsburg', name: 'VfL Wolfsburgo' },
      { id: 'werder-bremen', name: 'Werder Bremen' },
      { id: 'koln', name: '1. FC Colonia' },
      { id: 'mainz', name: 'Mainz 05' },
    ],
  },
  {
    id: 'ligue-1',
    league: 'Ligue 1',
    country: 'Francia',
    clubs: [
      { id: 'psg', name: 'Paris Saint-Germain' },
      { id: 'marsella', name: 'Marsella' },
      { id: 'monaco', name: 'Mónaco' },
      { id: 'lille', name: 'Lille' },
      { id: 'lyon', name: 'Lyon' },
      { id: 'niza', name: 'Niza' },
      { id: 'lens', name: 'Lens' },
      { id: 'rennes', name: 'Rennes' },
      { id: 'estrasburgo', name: 'Estrasburgo' },
      { id: 'toulouse', name: 'Toulouse' },
      { id: 'nantes', name: 'Nantes' },
      { id: 'brest', name: 'Brest' },
      { id: 'auxerre', name: 'Auxerre' },
      { id: 'angers', name: 'Angers' },
      { id: 'le-havre', name: 'Le Havre' },
      { id: 'metz', name: 'Metz' },
      { id: 'lorient', name: 'Lorient' },
      { id: 'paris-fc', name: 'Paris FC' },
    ],
  },
  {
    id: 'liga-profesional',
    league: 'Liga Profesional',
    country: 'Argentina',
    clubs: [
      { id: 'river-plate', name: 'River Plate' },
      { id: 'boca-juniors', name: 'Boca Juniors' },
      { id: 'racing', name: 'Racing' },
      { id: 'independiente', name: 'Independiente' },
      { id: 'san-lorenzo', name: 'San Lorenzo' },
      { id: 'estudiantes', name: 'Estudiantes' },
      { id: 'velez', name: 'Vélez' },
      { id: 'newells', name: "Newell's" },
      { id: 'rosario-central', name: 'Rosario Central' },
      { id: 'lanus', name: 'Lanús' },
      { id: 'talleres', name: 'Talleres' },
      { id: 'huracan', name: 'Huracán' },
    ],
  },
  {
    id: 'brasileirao',
    league: 'Brasileirão',
    country: 'Brasil',
    clubs: [
      { id: 'flamengo', name: 'Flamengo' },
      { id: 'palmeiras', name: 'Palmeiras' },
      { id: 'sao-paulo', name: 'São Paulo' },
      { id: 'corinthians', name: 'Corinthians' },
      { id: 'fluminense', name: 'Fluminense' },
      { id: 'botafogo', name: 'Botafogo' },
      { id: 'gremio', name: 'Grêmio' },
      { id: 'internacional', name: 'Internacional' },
    ],
  },
  {
    id: 'mls',
    league: 'MLS',
    country: 'Estados Unidos',
    clubs: [
      { id: 'inter-miami', name: 'Inter Miami' },
      { id: 'la-galaxy', name: 'LA Galaxy' },
      { id: 'lafc', name: 'LAFC' },
      { id: 'seattle-sounders', name: 'Seattle Sounders' },
    ],
  },
];

// --- Helpers de lookup ---------------------------------------------------
// El resto del juego (SeasonScene, CareerSummaryScene, main.js, etc.) usa
// estos helpers en vez de recorrer `leagues` a mano, para que el lookup por
// nombre (legacy) o por id (nuevo, persistido en `managers`) esté en un
// solo lugar.

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
// (legacy) a partir del nombre que viene seleccionado en el formulario.
// Si el club no está en la liga indicada, devuelve null (los selectores
// encadenados de main.js hacen que esto no pase en la práctica).
export function getClubByNameAndLeague(clubName, leagueName) {
  const liga = leagues.find((l) => l.league === leagueName);
  return liga?.clubs.find((c) => c.name === clubName) ?? null;
}

export function findClubIdByName(clubName) {
  const liga = getLeagueByClubName(clubName);
  return liga?.clubs.find((c) => c.name === clubName)?.id ?? null;
}