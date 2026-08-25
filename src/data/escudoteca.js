// Único lugar de escudos reales: mapa nombre → URL. Mismo rol que
// posiciones.js para las posiciones: data pura, sin DOM ni Supabase.
//
// Fuente principal: Escudoteca Paladar Negro (PNGs hotlinkeables). Refuerzo
// con media.api-sports.io (el mismo CDN de logos de liga que ya usa la UI)
// para Atlético, Girona, Mallorca y Real Oviedo.
//
// Las claves incluyen alias de nombre (corto del motor / largo de leagues.js
// / variantes de la DB / nombres EA de FC24) para que el lookup por `cl.name`
// de Supabase matchee sin importar cómo esté escrito el club. Si un escudo
// no existe en ESCUDOTECA o el CDN falla, el sistema de fallback automático
// en main.js (onerror) genera un SVG con las iniciales del club.

const PALADAR = 'https://paladarnegro.net/escudoteca';
const APISPORTS = 'https://media.api-sports.io/football/teams';
const WIKI = 'https://upload.wikimedia.org/wikipedia';

export const ESCUDOTECA = {
  // ── Premier League ──
  'Manchester City': `${PALADAR}/inglaterra/premier/png/manchestercity.png`,
  'Man City': `${PALADAR}/inglaterra/premier/png/manchestercity.png`,
  'Arsenal': `${PALADAR}/inglaterra/premier/png/arsenal.png`,
  'Liverpool': `${PALADAR}/inglaterra/premier/png/liverpool.png`,
  'Chelsea': `${PALADAR}/inglaterra/premier/png/chelsea.png`,
  'Manchester United': `${PALADAR}/inglaterra/premier/png/manchesterunited.png`,
  'Man Utd': `${PALADAR}/inglaterra/premier/png/manchesterunited.png`,
  'Tottenham Hotspur': `${PALADAR}/inglaterra/premier/png/tottenham.png`,
  'Tottenham': `${PALADAR}/inglaterra/premier/png/tottenham.png`,
  'Spurs': `${PALADAR}/inglaterra/premier/png/tottenham.png`,
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
  "Nott'm Forest": `${PALADAR}/inglaterra/premier/png/nottingham_forest.png`,
  'Bournemouth': `${PALADAR}/inglaterra/premier/png/bournemouth.png`,
  'Leeds United': `${PALADAR}/inglaterra/premier/png/leeds.png`,
  'Leeds': `${PALADAR}/inglaterra/premier/png/leeds.png`,
  'Sunderland': `${PALADAR}/inglaterra/premier/png/sunderland.png`,

  // Clubes faltantes de Premier League
  'Leicester City': `${PALADAR}/inglaterra/premier/png/leicester.png`,
  'Leicester': `${PALADAR}/inglaterra/premier/png/leicester.png`,
  'Southampton': `${PALADAR}/inglaterra/premier/png/southampton.png`,
  'Ipswich Town': `${PALADAR}/inglaterra/premier/png/ipswich_town.png`,
  'Ipswich': `${PALADAR}/inglaterra/premier/png/ipswich_town.png`,
  'Coventry City': `${PALADAR}/inglaterra/premier/png/coventry.png`,
  'Coventry': `${PALADAR}/inglaterra/premier/png/coventry.png`,
  'Hull City': `${PALADAR}/inglaterra/premier/png/hull_city.png`,
  'Hull': `${PALADAR}/inglaterra/premier/png/hull_city.png`,

  // ── LaLiga ──
  'Alavés': `${PALADAR}/espana/laliga/png/alaves.png`,
  'D. Alavés': `${PALADAR}/espana/laliga/png/alaves.png`,
  'Athletic Club': `${PALADAR}/espana/laliga/png/athletic.png`,
  'Athletic Bilbao': `${PALADAR}/espana/laliga/png/athletic.png`,
  'Atlético de Madrid': `${APISPORTS}/530.png`,
  'Atlético Madrid': `${APISPORTS}/530.png`,
  'Barcelona': `${PALADAR}/espana/laliga/png/barcelona.png`,
  'FC Barcelona': `${PALADAR}/espana/laliga/png/barcelona.png`,
  'Celta de Vigo': `${PALADAR}/espana/laliga/png/celta.png`,
  'Celta': `${PALADAR}/espana/laliga/png/celta.png`,
  'RC Celta': `${PALADAR}/espana/laliga/png/celta.png`,
  'Elche': `${PALADAR}/espana/laliga/png/elche.png`,
  'Elche CF': `${PALADAR}/espana/laliga/png/elche.png`,
  'Espanyol': `${PALADAR}/espana/laliga/png/espanyol.png`,
  'RCD Espanyol': `${PALADAR}/espana/laliga/png/espanyol.png`,
  'Getafe': `${PALADAR}/espana/laliga/png/getafe.png`,
  'Getafe CF': `${PALADAR}/espana/laliga/png/getafe.png`,
  'Girona': `${APISPORTS}/547.png`,
  'Girona FC': `${APISPORTS}/547.png`,
  'Levante': `${PALADAR}/espana/laliga/png/levante.png`,
  'Levante UD': `${PALADAR}/espana/laliga/png/levante.png`,
  'Mallorca': `${APISPORTS}/727.png`,
  'RCD Mallorca': `${APISPORTS}/727.png`,
  'Osasuna': `${PALADAR}/espana/laliga/png/osasuna.png`,
  'CA Osasuna': `${PALADAR}/espana/laliga/png/osasuna.png`,
  'Real Oviedo': `${APISPORTS}/720.png`,
  'R. Oviedo': `${APISPORTS}/720.png`,
  'Rayo Vallecano': `${PALADAR}/espana/laliga/png/rayovallecano.png`,
  'Real Betis': `${PALADAR}/espana/laliga/png/betis.png`,
  'Betis': `${PALADAR}/espana/laliga/png/betis.png`,
  'Real Madrid': `${PALADAR}/espana/laliga/png/realmadrid.png`,
  'Real Sociedad': `${PALADAR}/espana/laliga/png/realsociedad.png`,
  'Sevilla': `${PALADAR}/espana/laliga/png/sevilla.png`,
  'Sevilla FC': `${PALADAR}/espana/laliga/png/sevilla.png`,
  'Valencia': `${PALADAR}/espana/laliga/png/valencia.png`,
  'Valencia CF': `${PALADAR}/espana/laliga/png/valencia.png`,
  'Villarreal': `${PALADAR}/espana/laliga/png/villarreal.png`,
  'Villarreal CF': `${PALADAR}/espana/laliga/png/villarreal.png`,

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
  // Paladar tiene la mayoría; Heidenheim, Wolfsburg, St. Pauli y Hannover van
  // desde Wikimedia (Paladar no los tiene, y api-sports mostraba escudos mal).
  'Bayern München':       `${PALADAR}/alemania/bundesliga/png/bayernmunchen.png`,
  'FC Bayern München':    `${PALADAR}/alemania/bundesliga/png/bayernmunchen.png`,
  'Borussia Dortmund':    `${PALADAR}/alemania/bundesliga/png/borussiadortmund.png`,
  'Bayer Leverkusen':     `${PALADAR}/alemania/bundesliga/png/bayerleverkusen.png`,
  'RB Leipzig':           `${PALADAR}/alemania/bundesliga/png/rbleipzig.png`,
  "B. M'gladbach":        `${PALADAR}/alemania/bundesliga/png/bmonchengladbach.png`,
  'Borussia M\'gladbach': `${PALADAR}/alemania/bundesliga/png/bmonchengladbach.png`,
  'Borussia Mönchengladbach': `${PALADAR}/alemania/bundesliga/png/bmonchengladbach.png`,
  'E. Frankfurt':         `${PALADAR}/alemania/bundesliga/png/eintrachtfrankfurt.png`,
  'Eintracht Frankfurt':  `${PALADAR}/alemania/bundesliga/png/eintrachtfrankfurt.png`,
  'VfL Wolfsburg':        `${WIKI}/commons/thumb/c/c5/VfL_Wolfsburg_logo_2026.svg/330px-VfL_Wolfsburg_logo_2026.svg.png`,
  'SC Freiburg':          `${PALADAR}/alemania/bundesliga/png/freiburg.png`,
  'Union Berlin':         `${PALADAR}/alemania/bundesliga/png/unionberlin.png`,
  '1. FC Union Berlin':   `${PALADAR}/alemania/bundesliga/png/unionberlin.png`,
  'VfB Stuttgart':        `${PALADAR}/alemania/bundesliga/png/stuttgart.png`,
  'Werder Bremen':        `${PALADAR}/alemania/bundesliga/png/werderbremen.png`,
  '1. FC Heidenheim':     `${WIKI}/commons/thumb/9/9d/1._FC_Heidenheim_1846.svg/500px-1._FC_Heidenheim_1846.svg.png`,
  'FC Augsburg':          `${PALADAR}/alemania/bundesliga/png/augsburgo.png`,
  'TSG Hoffenheim':       `${PALADAR}/alemania/bundesliga/png/hoffenheim.png`,
  '1. FSV Mainz 05':      `${PALADAR}/alemania/bundesliga/png/mainz05.png`,
  'Mainz 05':             `${PALADAR}/alemania/bundesliga/png/mainz05.png`,
  'FC St. Pauli':         `${WIKI}/commons/thumb/b/b3/Fc_st_pauli_logo.svg/330px-Fc_st_pauli_logo.svg.png`,
  'St. Pauli':            `${WIKI}/commons/thumb/b/b3/Fc_st_pauli_logo.svg/330px-Fc_st_pauli_logo.svg.png`,
  'Hamburger SV':         `${PALADAR}/alemania/bundesliga/png/hamburgo.png`,
  'HSV':                  `${PALADAR}/alemania/bundesliga/png/hamburgo.png`,
  'Hannover 96':          `${WIKI}/commons/thumb/c/cd/Hannover_96_Logo.svg/330px-Hannover_96_Logo.svg.png`,

  // ── Liga Profesional Argentina ──
  // Path real: argentina/primeradivision/png/ (no liga-profesional).
  // Godoy Cruz no existe en Paladar → api-sports.
  'Boca Juniors':         `${PALADAR}/argentina/primeradivision/png/boca.png`,
  'Racing Club':          `${PALADAR}/argentina/primeradivision/png/racing.png`,
  'River Plate':          `${PALADAR}/argentina/primeradivision/png/river.png`,
  'Independiente':        `${PALADAR}/argentina/primeradivision/png/independiente.png`,
  'San Lorenzo':          `${PALADAR}/argentina/primeradivision/png/sanlorenzo.png`,
  'Estudiantes':          `${PALADAR}/argentina/primeradivision/png/estudiantes.png`,
  'Vélez Sarsfield':      `${PALADAR}/argentina/primeradivision/png/velez.png`,
  'Talleres':             `${PALADAR}/argentina/primeradivision/png/talleres.png`,
  'Defensa y Justicia':   `${PALADAR}/argentina/primeradivision/png/defensa.png`,
  'Lanús':                `${PALADAR}/argentina/primeradivision/png/lanus.png`,
  'Godoy Cruz':           `${WIKI}/commons/thumb/8/89/Logo_of_CD_Godoy_Cruz_Antonio_Tomba.png/330px-Logo_of_CD_Godoy_Cruz_Antonio_Tomba.png`,
  'Huracán':              `${PALADAR}/argentina/primeradivision/png/huracan.png`,
  "Newell's Old Boys":    `${PALADAR}/argentina/primeradivision/png/newells.png`,
  'Rosario Central':      `${PALADAR}/argentina/primeradivision/png/rosariocentral.png`,
  'Belgrano':             `${PALADAR}/argentina/primeradivision/png/belgrano.png`,
  'Argentinos Juniors':   `${PALADAR}/argentina/primeradivision/png/argentinos.png`,
  'Banfield':             `${PALADAR}/argentina/primeradivision/png/banfield.png`,
  'Atlético Tucumán':     `${PALADAR}/argentina/primeradivision/png/atleticotucuman.png`,
  'Platense':             `${PALADAR}/argentina/primeradivision/png/platense.png`,
  'Tigre':                `${PALADAR}/argentina/primeradivision/png/tigre.png`,

  // ── MLS ──
  // Slugs verificados en paladarnegro.net/escudoteca/estadosunidos/mls/.
  // Ojo: 'realstaltlake' (typo del sitio), 'losangeles' = LAFC, 'losangelesgalaxy' = LA Galaxy.
  'Inter Miami CF':       `${PALADAR}/estadosunidos/mls/png/intermiami.png`,
  'LA Galaxy':            `${PALADAR}/estadosunidos/mls/png/losangelesgalaxy.png`,
  'LAFC':                 `${PALADAR}/estadosunidos/mls/png/losangeles.png`,
  'Seattle Sounders FC':  `${PALADAR}/estadosunidos/mls/png/seattle.png`,
  'Portland Timbers':     `${PALADAR}/estadosunidos/mls/png/portland.png`,
  'Atlanta United FC':    `${PALADAR}/estadosunidos/mls/png/atlanta.png`,
  'New York City FC':     `${PALADAR}/estadosunidos/mls/png/newyorkcity.png`,
  'New York Red Bulls':   `${PALADAR}/estadosunidos/mls/png/newyork.png`,
  'New England Revolution': `${PALADAR}/estadosunidos/mls/png/newengland.png`,
  'Philadelphia Union':   `${PALADAR}/estadosunidos/mls/png/philadelphia.png`,
  'FC Dallas':            `${PALADAR}/estadosunidos/mls/png/dallas.png`,
  'Columbus Crew':        `${PALADAR}/estadosunidos/mls/png/columbus.png`,
  'Houston Dynamo FC':    `${PALADAR}/estadosunidos/mls/png/houstondynamo.png`,
  'Sporting Kansas City': `${PALADAR}/estadosunidos/mls/png/kansascity.png`,
  'Colorado Rapids':      `${PALADAR}/estadosunidos/mls/png/colorado.png`,
  'D.C. United':          `${PALADAR}/estadosunidos/mls/png/dcunited.png`,
  'Toronto FC':           `${PALADAR}/estadosunidos/mls/png/toronto.png`,
  'Vancouver Whitecaps FC': `${PALADAR}/estadosunidos/mls/png/vancouver.png`,
  'Real Salt Lake':       `${PALADAR}/estadosunidos/mls/png/realstaltlake.png`,
  'Chicago Fire FC':      `${PALADAR}/estadosunidos/mls/png/chicago.png`,
  'Minnesota United FC':  `${PALADAR}/estadosunidos/mls/png/minnesota.png`,
  'Austin FC':            `${PALADAR}/estadosunidos/mls/png/austin.png`,
  'Nashville SC':         `${PALADAR}/estadosunidos/mls/png/nashville.png`,
  'Charlotte FC':         `${PALADAR}/estadosunidos/mls/png/charlotte.png`,
  'CF Montréal':          `${PALADAR}/estadosunidos/mls/png/montreal.png`,
  'Orlando City SC':      `${PALADAR}/estadosunidos/mls/png/orlandocity.png`,
  'FC Cincinnati':        `${PALADAR}/estadosunidos/mls/png/cincinnati.png`,
  'San Jose Earthquakes': `${PALADAR}/estadosunidos/mls/png/sanjose.png`,
  'St. Louis City SC':    `${PALADAR}/estadosunidos/mls/png/st_louis_city.png`,
  'San Diego FC':         `${PALADAR}/estadosunidos/mls/png/sandiego.png`,

  // ── Ligue 1 ──
  // Paladar path: francia/ligue1/png/. Reims, Nantes, Brest, Montpellier,
  // Saint-Étienne y Metz no están en Paladar → Wikimedia. Ojo: 'stadebretois'
  // en Paladar es el Stade Rennais (usan el nombre viejo del club).
  'Paris SG':             `${PALADAR}/francia/ligue1/png/psg.png`,
  'PSG':                  `${PALADAR}/francia/ligue1/png/psg.png`,
  'Monaco':               `${PALADAR}/francia/ligue1/png/monaco.png`,
  'Marseille':            `${PALADAR}/francia/ligue1/png/olimpiquemarsella.png`,
  'Lyon':                 `${PALADAR}/francia/ligue1/png/olympiquelyon.png`,
  'Lille':                `${PALADAR}/francia/ligue1/png/lille.png`,
  'Nice':                 `${PALADAR}/francia/ligue1/png/niza.png`,
  'Lens':                 `${PALADAR}/francia/ligue1/png/racinglens.png`,
  'Rennes':               `${PALADAR}/francia/ligue1/png/rennais.png`,
  'Strasbourg':           `${PALADAR}/francia/ligue1/png/racingetrasburgo.png`,
  'Reims':                `${WIKI}/fr/thumb/a/ad/Logo_Stade_de_Reims_2020_%28Alternatif%29.svg/330px-Logo_Stade_de_Reims_2020_%28Alternatif%29.svg.png`,
  'Toulouse':             `${PALADAR}/francia/ligue1/png/toulouse.png`,
  'Nantes':               `${WIKI}/commons/thumb/4/45/Logo_FC_Nantes_%28avec_fond%29_-_2019.svg/330px-Logo_FC_Nantes_%28avec_fond%29_-_2019.svg.png`,
  'Brest':                `${WIKI}/fr/thumb/4/4c/Logo_SB29_2010.svg/500px-Logo_SB29_2010.svg.png`,
  'Montpellier':          `${WIKI}/fr/thumb/3/35/Logo_Montpellier_HSC_-_2025.svg/330px-Logo_Montpellier_HSC_-_2025.svg.png`,
  'Le Havre':             `${PALADAR}/francia/ligue1/png/havre.png`,
  'Saint-Étienne':        `${WIKI}/fr/thumb/3/3e/AS_Saint-Etienne-logo_2022.svg/330px-AS_Saint-Etienne-logo_2022.svg.png`,
  'Saint-Etienne':        `${WIKI}/fr/thumb/3/3e/AS_Saint-Etienne-logo_2022.svg/330px-AS_Saint-Etienne-logo_2022.svg.png`,
  'Angers':               `${PALADAR}/francia/ligue1/png/angers.png`,
  'Auxerre':              `${PALADAR}/francia/ligue1/png/auxerre.png`,
  'Metz':                 `${WIKI}/commons/thumb/4/4a/FC_Metz_2021_Logo.svg/330px-FC_Metz_2021_Logo.svg.png`,
  'Lorient':              `${PALADAR}/francia/ligue1/png/lorient.png`,
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
