// badgeResolver.js — resuelve automáticamente (sin descargar ni guardar
// nada en el repo) las imágenes que necesita el formulario "Creá tu DT":
// banderas de país vía FlagCDN, y logos de liga / escudos de club vía
// TheSportsDB. Si TheSportsDB no encuentra nada (o la petición falla), cae
// en un avatar de iniciales de UI-Avatars. Los resultados de liga/club se
// cachean en memoria para no repetir el fetch si el jugador reabre el mismo
// dropdown.
const THESPORTSDB_KEY = '3'; // clave pública de pruebas de TheSportsDB

// Nombres EA de fantasía (FC24) → nombre real que conoce TheSportsDB.
// leagues.js guarda como `club.name` el nombre impreso en la carta
// ("Bergamo Calcio", "Milano FC", "Latium"…), pero la búsqueda por nombre de
// TheSportsDB no encuentra esos nombres de fantasía: el escudo se busca con
// el nombre real del club y el label del dropdown sigue mostrando el nombre
// EA (el que ve el jugador).
const CLUB_BADGE_ALIAS = {
  // Serie A
  'Bergamo Calcio': 'Atalanta',
  'Latium': 'Lazio',
  'Lombardia FC': 'Inter Milan',
  'Milano FC': 'AC Milan',
  'SSC Napoli': 'Napoli',
};

// ids estables de TheSportsDB para las ligas del catálogo (leagues.js).
// Resolver por id (lookupleague.php?id=) es mucho más confiable que buscar
// por nombre: el buscador de la API no encuentra nombres en español como
// "LaLiga" o "Liga Profesional". El key (nombre legible o id del catálogo)
// permite que getLeagueLogoUrl funcione con cualquiera de los dos.
const LEAGUE_LOGO_IDS = {
  'Premier League': '4328',
  'premier': '4328',
  'premier-league': '4328',
  'LaLiga': '4335',
  'laliga': '4335',
  'Serie A': '4332',
  'seriea': '4332',
  'serie-a': '4332',
  'Bundesliga': '4331',
  'bundesliga': '4331',
  'Ligue 1': '4334',
  'ligue-1': '4334',
  'Liga Profesional': '4406',
  'liga-profesional': '4406',
  'Brasileirão': '4351',
  'brasileirao': '4351',
  'MLS': '4346',
  'mls': '4346',
};

const leagueLogoCache = new Map();
const clubBadgeCache = new Map();

export function getCountryFlagUrl(isoCode) {
  return `https://flagcdn.com/w20/${isoCode.toLowerCase()}.png`;
}

export function getInitialsAvatarUrl(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e2a4a&color=d4af37&bold=true`;
}

// Busca en TheSportsDB, cachea el resultado (o el fallback, para no
// reintentar en cada apertura del dropdown) y siempre devuelve una URL
// válida: la real si la encontró, o el avatar de iniciales si no.
async function resolveConCache(cache, nombre, url, extraerBadge) {
  if (cache.has(nombre)) return cache.get(nombre);

  let resuelta = getInitialsAvatarUrl(nombre);
  try {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      const badge = extraerBadge(data);
      if (badge) resuelta = badge;
    }
  } catch (error) {
    console.warn(`No se pudo resolver la imagen de "${nombre}":`, error);
  }

  cache.set(nombre, resuelta);
  return resuelta;
}

export function getClubBadgeUrl(clubName) {
  // El escudo se busca con el nombre real (alias EA → TheSportsDB); el cache
  // queda keyeado por el nombre del catálogo para no duplicar entradas.
  const nombreReal = CLUB_BADGE_ALIAS[clubName] ?? clubName;
  const url = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_KEY}/searchteams.php?t=${encodeURIComponent(nombreReal)}`;
  return resolveConCache(
    clubBadgeCache,
    clubName,
    url,
    // La documentación de TheSportsDB anuncia "strTeamBadge", pero la
    // respuesta real de este endpoint hoy trae el escudo en "strBadge"
    // (y a veces solo "strLogo"): probamos los tres por si el campo
    // cambia según la versión de la API.
    (data) => {
      const badge = data?.teams?.[0]?.strTeamBadge || data?.teams?.[0]?.strBadge || data?.teams?.[0]?.strLogo;
      if (!badge) {
        // Diagnóstico: si un club (con o sin alias) no resuelve escudo, la
        // URL intentada queda acá para agregar el caso que falte en el futuro.
        console.warn(`[badgeResolver] TheSportsDB no devolvió escudo para "${clubName}" → ${url}`);
      }
      return badge;
    },
  );
}

export function getLeagueLogoUrl(leagueNameOrId) {
  const theSportsDbId = LEAGUE_LOGO_IDS[leagueNameOrId];
  if (!theSportsDbId) {
    // Liga fuera del mapeo: no podemos resolver un logo confiable, así que
    // caemos directo al avatar de iniciales sin intentar un lookup frágil.
    return Promise.resolve(getInitialsAvatarUrl(leagueNameOrId));
  }
  const url = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_KEY}/lookupleague.php?id=${theSportsDbId}`;
  return resolveConCache(
    leagueLogoCache,
    theSportsDbId,
    url,
    (data) => data?.leagues?.[0]?.strBadge || data?.leagues?.[0]?.strLogo,
  );
}
