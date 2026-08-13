// Único lugar de escudos reales: mapa nombre → URL. Mismo rol que
// posiciones.js para las posiciones: data pura, sin DOM ni Supabase.
//
// Fuente principal: Escudoteca Paladar Negro (PNGs hotlinkeables). Refuerzo
// con media.api-sports.io (el mismo CDN de logos de liga que ya usa la UI)
// para los clubes que la teca no tiene: Atlético, Girona, Mallorca.
// Luton Town y Real Oviedo no tienen URL → quedan cubiertos por el fallback
// SVG generado por nombre (badgeGenerator.js) en la UI.
//
// Las claves incluyen alias de nombre (corto del motor / largo de leagues.js
// / variantes de la DB) para que el lookup por `cl.name` de Supabase matchee
// sin importar cómo esté escrito el club.

const PALADAR = 'https://paladarnegro.net/escudoteca';
const APISPORTS = 'https://media.api-sports.io/football/teams';

export const ESCUDOTECA = {
  // ── Premier League ──
  'Manchester City': `${PALADAR}/inglaterra/premier/png/manchestercity.png`,
  'Arsenal': `${PALADAR}/inglaterra/premier/png/arsenal.png`,
  'Liverpool': `${PALADAR}/inglaterra/premier/png/liverpool.png`,
  'Chelsea': `${PALADAR}/inglaterra/premier/png/chelsea.png`,
  'Manchester United': `${PALADAR}/inglaterra/premier/png/manchesterunited.png`,
  'Tottenham Hotspur': `${PALADAR}/inglaterra/premier/png/tottenham.png`,
  'Tottenham': `${PALADAR}/inglaterra/premier/png/tottenham.png`,
  'Aston Villa': `${PALADAR}/inglaterra/premier/png/astonvilla.png`,
  'Newcastle United': `${PALADAR}/inglaterra/premier/png/newcastle.png`,
  'Newcastle': `${PALADAR}/inglaterra/premier/png/newcastle.png`,
  'West Ham United': `${PALADAR}/inglaterra/premier/png/westham.png`,
  'West Ham': `${PALADAR}/inglaterra/premier/png/westham.png`,
  'Brighton & Hove Albion': `${PALADAR}/inglaterra/premier/png/brighton.png`,
  'Brighton': `${PALADAR}/inglaterra/premier/png/brighton.png`,
  'Burnley': `${PALADAR}/inglaterra/premier/png/burnley.png`,
  'Sheffield United': `${PALADAR}/inglaterra/championship/png/sheffield.png`,
  'Brentford': `${PALADAR}/inglaterra/premier/png/brentford.png`,
  'Everton': `${PALADAR}/inglaterra/premier/png/everton.png`,
  'Crystal Palace': `${PALADAR}/inglaterra/premier/png/crystalpalace.png`,
  'Fulham': `${PALADAR}/inglaterra/premier/png/fulham.png`,
  'Wolverhampton Wanderers': `${PALADAR}/inglaterra/premier/png/wolves.png`,
  'Wolverhampton': `${PALADAR}/inglaterra/premier/png/wolves.png`,
  'Nottingham Forest': `${PALADAR}/inglaterra/premier/png/nottingham_forest.png`,
  'Bournemouth': `${PALADAR}/inglaterra/premier/png/bournemouth.png`,
  'Leeds United': `${PALADAR}/inglaterra/premier/png/leeds.png`,
  'Leeds': `${PALADAR}/inglaterra/premier/png/leeds.png`,
  'Sunderland': `${PALADAR}/inglaterra/premier/png/sunderland.png`,

  // ── LaLiga ──
  'Alavés': `${PALADAR}/espana/laliga/png/alaves.png`,
  'Athletic Club': `${PALADAR}/espana/laliga/png/athletic.png`,
  'Athletic Bilbao': `${PALADAR}/espana/laliga/png/athletic.png`,
  'Atlético de Madrid': `${APISPORTS}/530.png`,
  'Atlético Madrid': `${APISPORTS}/530.png`,
  'Barcelona': `${PALADAR}/espana/laliga/png/barcelona.png`,
  'Celta de Vigo': `${PALADAR}/espana/laliga/png/celta.png`,
  'Celta': `${PALADAR}/espana/laliga/png/celta.png`,
  'Elche': `${PALADAR}/espana/laliga/png/elche.png`,
  'Espanyol': `${PALADAR}/espana/laliga/png/espanyol.png`,
  'Getafe': `${PALADAR}/espana/laliga/png/getafe.png`,
  'Girona': `${APISPORTS}/547.png`,
  'Levante': `${PALADAR}/espana/laliga/png/levante.png`,
  'Mallorca': `${APISPORTS}/552.png`,
  'Osasuna': `${PALADAR}/espana/laliga/png/osasuna.png`,
  'Rayo Vallecano': `${PALADAR}/espana/laliga/png/rayovallecano.png`,
  'Real Betis': `${PALADAR}/espana/laliga/png/betis.png`,
  'Betis': `${PALADAR}/espana/laliga/png/betis.png`,
  'Real Madrid': `${PALADAR}/espana/laliga/png/realmadrid.png`,
  'Real Sociedad': `${PALADAR}/espana/laliga/png/realsociedad.png`,
  'Sevilla': `${PALADAR}/espana/laliga/png/sevilla.png`,
  'Valencia': `${PALADAR}/espana/laliga/png/valencia.png`,
  'Villarreal': `${PALADAR}/espana/laliga/png/villarreal.png`,

  // ── Serie A ──
  // Los nombres EA de FC24 (leagues.js) matchean por la clave EA; el alias con
  // el nombre real cubre el lookup cuando el club viene escrito de otra forma
  // (TheSportsDB, tables del motor, etc.). Todos los slugs verificados contra
  // Paladar Negro (Hellas Verona usa `hellasverona.png`, sin espacio ni guión).
  'AS Roma': `${PALADAR}/italia/seriea/png/roma.png`,
  'Roma': `${PALADAR}/italia/seriea/png/roma.png`,
  'Bergamo Calcio': `${PALADAR}/italia/seriea/png/atalanta.png`,
  'Atalanta': `${PALADAR}/italia/seriea/png/atalanta.png`,
  'Bologna': `${PALADAR}/italia/seriea/png/bologna.png`,
  'Cagliari': `${PALADAR}/italia/seriea/png/cagliari.png`,
  'Como': `${PALADAR}/italia/seriea/png/como.png`,
  'Cremonese': `${PALADAR}/italia/seriea/png/cremonese.png`,
  'Fiorentina': `${PALADAR}/italia/seriea/png/fiorentina.png`,
  'Genoa': `${PALADAR}/italia/seriea/png/genoa.png`,
  'Hellas Verona': `${PALADAR}/italia/seriea/png/hellasverona.png`,
  'Verona': `${PALADAR}/italia/seriea/png/hellasverona.png`,
  'Juventus': `${PALADAR}/italia/seriea/png/juventus.png`,
  'Latium': `${PALADAR}/italia/seriea/png/lazio.png`,
  'Lazio': `${PALADAR}/italia/seriea/png/lazio.png`,
  'Lecce': `${PALADAR}/italia/seriea/png/lecce.png`,
  'Lombardia FC': `${PALADAR}/italia/seriea/png/inter.png`,
  'Inter': `${PALADAR}/italia/seriea/png/inter.png`,
  'Inter Milan': `${PALADAR}/italia/seriea/png/inter.png`,
  'Milano FC': `${PALADAR}/italia/seriea/png/milan.png`,
  'Milan': `${PALADAR}/italia/seriea/png/milan.png`,
  'AC Milan': `${PALADAR}/italia/seriea/png/milan.png`,
  'Parma': `${PALADAR}/italia/seriea/png/parma.png`,
  'Pisa': `${PALADAR}/italia/seriea/png/pisa.png`,
  'SSC Napoli': `${PALADAR}/italia/seriea/png/napoli.png`,
  'Napoli': `${PALADAR}/italia/seriea/png/napoli.png`,
  'Sassuolo': `${PALADAR}/italia/seriea/png/sassuolo.png`,
  'Torino': `${PALADAR}/italia/seriea/png/torino.png`,
  'Udinese': `${PALADAR}/italia/seriea/png/udinese.png`,

  // ── Bundesliga ──
  'Bayern München':       `${APISPORTS}/157.png`,
  'FC Bayern München':    `${APISPORTS}/157.png`,
  'Borussia Dortmund':    `${APISPORTS}/165.png`,
  'Bayer Leverkusen':     `${APISPORTS}/168.png`,
  'RB Leipzig':           `${APISPORTS}/173.png`,
  "B. M'gladbach":        `${APISPORTS}/163.png`,
  'Borussia M\'gladbach': `${APISPORTS}/163.png`,
  'Borussia Mönchengladbach': `${APISPORTS}/163.png`,
  'E. Frankfurt':         `${APISPORTS}/169.png`,
  'Eintracht Frankfurt':  `${APISPORTS}/169.png`,
  'VfL Wolfsburg':        `${APISPORTS}/161.png`,
  'SC Freiburg':          `${APISPORTS}/160.png`,
  'Union Berlin':         `${APISPORTS}/182.png`,
  '1. FC Union Berlin':   `${APISPORTS}/182.png`,
  'VfB Stuttgart':        `${APISPORTS}/172.png`,
  'Werder Bremen':        `${APISPORTS}/162.png`,
  '1. FC Heidenheim':     `${APISPORTS}/10242.png`,
  'FC Augsburg':          `${APISPORTS}/170.png`,
  'TSG Hoffenheim':       `${APISPORTS}/167.png`,
  '1. FSV Mainz 05':      `${APISPORTS}/164.png`,
  'Mainz 05':             `${APISPORTS}/164.png`,
  'FC St. Pauli':         `${APISPORTS}/186.png`,
  'St. Pauli':            `${APISPORTS}/186.png`,
  'Hamburger SV':         `${APISPORTS}/174.png`,
  'HSV':                  `${APISPORTS}/174.png`,
  'Hannover 96':          `${APISPORTS}/175.png`,

  // ── Liga Profesional Argentina ──
  'Boca Juniors':         `${APISPORTS}/405.png`,
  'Racing Club':          `${APISPORTS}/412.png`,
  'River Plate':          `${APISPORTS}/408.png`,
  'Independiente':        `${APISPORTS}/410.png`,
  'San Lorenzo':          `${APISPORTS}/411.png`,
  'Estudiantes':          `${APISPORTS}/413.png`,
  'Vélez Sarsfield':      `${APISPORTS}/415.png`,
  'Talleres':             `${APISPORTS}/457.png`,
  'Defensa y Justicia':   `${APISPORTS}/449.png`,
  'Lanús':                `${APISPORTS}/414.png`,
  'Godoy Cruz':           `${APISPORTS}/435.png`,
  'Huracán':              `${APISPORTS}/416.png`,
  "Newell's Old Boys":    `${APISPORTS}/439.png`,
  'Rosario Central':      `${APISPORTS}/440.png`,
  'Belgrano':             `${APISPORTS}/432.png`,
  'Argentinos Juniors':   `${APISPORTS}/431.png`,
  'Banfield':             `${APISPORTS}/444.png`,
  'Atlético Tucumán':     `${APISPORTS}/433.png`,

  // ── MLS ──
  'Inter Miami CF':       `${APISPORTS}/1616.png`,
  'LA Galaxy':            `${APISPORTS}/1605.png`,
  'LAFC':                 `${APISPORTS}/1615.png`,
  'Seattle Sounders FC':  `${APISPORTS}/1609.png`,
  'Portland Timbers':     `${APISPORTS}/1608.png`,
  'Atlanta United FC':    `${APISPORTS}/1612.png`,
  'New York City FC':     `${APISPORTS}/1604.png`,
  'New York Red Bulls':   `${APISPORTS}/1601.png`,
  'New England Revolution': `${APISPORTS}/1600.png`,
  'Philadelphia Union':   `${APISPORTS}/1614.png`,
  'FC Dallas':            `${APISPORTS}/1603.png`,
  'Columbus Crew':        `${APISPORTS}/1602.png`,
  'Houston Dynamo FC':    `${APISPORTS}/1606.png`,
  'Sporting Kansas City': `${APISPORTS}/1607.png`,
  'Colorado Rapids':      `${APISPORTS}/1610.png`,
  'D.C. United':          `${APISPORTS}/1599.png`,
  'Toronto FC':           `${APISPORTS}/1611.png`,
  'Vancouver Whitecaps FC': `${APISPORTS}/1613.png`,
  'Real Salt Lake':       `${APISPORTS}/1618.png`,
  'Chicago Fire FC':      `${APISPORTS}/1619.png`,
  'Minnesota United FC':  `${APISPORTS}/1621.png`,
  'Austin FC':            `${APISPORTS}/2274.png`,
  'Nashville SC':         `${APISPORTS}/2273.png`,
  'Charlotte FC':         `${APISPORTS}/2283.png`,
  'CF Montréal':          `${APISPORTS}/1617.png`,
  'Orlando City SC':      `${APISPORTS}/1620.png`,
  'FC Cincinnati':        `${APISPORTS}/2272.png`,

  // ── Ligue 1 ──
  'Paris SG':             `${APISPORTS}/85.png`,
  'PSG':                  `${APISPORTS}/85.png`,
  'Monaco':               `${APISPORTS}/91.png`,
  'Marseille':            `${APISPORTS}/81.png`,
  'Lyon':                 `${APISPORTS}/80.png`,
  'Lille':                `${APISPORTS}/79.png`,
  'Nice':                 `${APISPORTS}/84.png`,
  'Lens':                 `${APISPORTS}/116.png`,
  'Rennes':               `${APISPORTS}/94.png`,
  'Strasbourg':           `${APISPORTS}/95.png`,
  'Reims':                `${APISPORTS}/93.png`,
  'Toulouse':             `${APISPORTS}/96.png`,
  'Nantes':               `${APISPORTS}/83.png`,
  'Brest':                `${APISPORTS}/113.png`,
  'Montpellier':          `${APISPORTS}/82.png`,
  'Le Havre':             `${APISPORTS}/112.png`,
  'Saint-Étienne':        `${APISPORTS}/97.png`,
  'Saint-Etienne':        `${APISPORTS}/97.png`,
  'Angers':               `${APISPORTS}/778.png`,
  'Auxerre':              `${APISPORTS}/110.png`,
  'Metz':                 `${APISPORTS}/111.png`,
  'Lorient':              `${APISPORTS}/114.png`,
'Boca Juniors': `${PALADAR}/argentina/liga-profesional/png/bocajuniors.png`,
'River Plate': `${PALADAR}/argentina/liga-profesional/png/riverplate.png`,
'Independiente': `${PALADAR}/argentina/liga-profesional/png/independiente.png`,
'Racing Club': `${PALADAR}/argentina/liga-profesional/png/racing.png`,
'San Lorenzo': `${PALADAR}/argentina/liga-profesional/png/sanlorenzo.png`,
'Vélez Sarsfield': `${PALADAR}/argentina/liga-profesional/png/velez.png`,
'Rosario Central': `${PALADAR}/argentina/liga-profesional/png/rosariocentral.png`,
'Colón': `${PALADAR}/argentina/liga-profesional/png/colon.png`,
'Talleres': `${PALADAR}/argentina/liga-profesional/png/talleres.png`,
'Belgrano': `${PALADAR}/argentina/liga-profesional/png/belgrano.png`,
'Huracán': `${PALADAR}/argentina/liga-profesional/png/huracan.png`,
'Tigre': `${PALADAR}/argentina/liga-profesional/png/tigre.png`,
'Lanús': `${PALADAR}/argentina/liga-profesional/png/lanus.png`,
'Banfield': `${PALADAR}/argentina/liga-profesional/png/banfield.png`,
'Argentinos Juniors': `${PALADAR}/argentina/liga-profesional/png/argentinosjuniors.png`,
'Atlético Tucumán': `${PALADAR}/argentina/liga-profesional/png/atltucuman.png`,
};

// Normaliza un nombre de club a una clave estable: minúsculas, sin acentos,
// sin puntuación/espacios y sin prefijos/sufijos comunes de sociedades
// (FC / CF / RCD / UD / CA / RC / AFC / Deportivo…). Así 'FC Barcelona' y
// 'Barcelona' resuelven a la misma entrada sin depender del nombre exacto.
const NORM = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .replace(/^(cf|fc|rcd|ud|ca|rc|afc|cd|sd|de|del|deportivo)+/, '')
    .replace(/(cf|fc|ud|cd|sd)$/, '');

const indice = new Map();
for (const [nombre, url] of Object.entries(ESCUDOTECA)) {
  indice.set(NORM(nombre), url);
}

/** URL del escudo real de un club por su nombre, o null si no está en la teca. */
export function escudoDeNombre(nombre) {
  return indice.get(NORM(nombre)) ?? null;
}
