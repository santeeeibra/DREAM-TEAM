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
