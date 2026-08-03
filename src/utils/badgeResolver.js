// badgeResolver.js — resuelve automáticamente (sin descargar ni guardar
// nada en el repo) las imágenes que necesita el formulario "Creá tu DT":
// banderas de país vía FlagCDN, y logos de liga / escudos de club vía
// TheSportsDB. Si TheSportsDB no encuentra nada (o la petición falla), cae
// en un avatar de iniciales de UI-Avatars. Los resultados de liga/club se
// cachean en memoria para no repetir el fetch si el jugador reabre el mismo
// dropdown.
const THESPORTSDB_KEY = '3'; // clave pública de pruebas de TheSportsDB

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
  const url = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_KEY}/searchteams.php?t=${encodeURIComponent(clubName)}`;
  return resolveConCache(
    clubBadgeCache,
    clubName,
    url,
    // La documentación de TheSportsDB anuncia "strTeamBadge", pero la
    // respuesta real de este endpoint hoy trae el escudo en "strBadge"
    // (y a veces solo "strLogo"): probamos los tres por si el campo
    // cambia según la versión de la API.
    (data) => data?.teams?.[0]?.strTeamBadge || data?.teams?.[0]?.strBadge || data?.teams?.[0]?.strLogo,
  );
}

export function getLeagueLogoUrl(leagueName) {
  const url = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_KEY}/searchleagues.php?l=${encodeURIComponent(leagueName)}`;
  return resolveConCache(
    leagueLogoCache,
    leagueName,
    url,
    (data) => data?.leagues?.[0]?.strBadge || data?.leagues?.[0]?.strLogo,
  );
}
