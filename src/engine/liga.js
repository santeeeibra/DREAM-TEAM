// PURA. Resolución de temporada por tramos (§2.2): sin motor de partido en vivo.
import { LIGA, FUERZA, ESCALADA_LIGA, ESTILOS_CLUB, TIER_LIGA, TIER_LIGA_DEFAULT, FUERZA_POR_TIER, BOOST_RIVAL_GLOBAL } from './balance.js';
import { getLeagueById } from '../data/leagues.js';

export const MI_EQUIPO = 0;

// Cuando el DT no tiene liga (carreras legacy / harness sin club real), la
// arena se arma con los clubes reales de Premier: una sola fuente de clubes,
// nunca una lista de rivales duplicada a mano.
const LIGA_FALLBACK = 'premier';

// Normaliza el nombre de un club para comparar tolerante (FC Barcelona ≈
// Barcelona, Sevilla FC ≈ Sevilla, CA Osasuna ≈ Osasuna): quita acentos y
// los prefijos típicos de los nombres EA/fantasia. Sirve para excluir al
// propio club cuando su nombre viene de otra fuente (p. ej. la tabla `clubs`
// de temporada actual vs. las cartas FC24).
function normalizarNombreClub(nombre) {
  return (nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(fc|cf|ud|cd|ca|ssc|sc|as|sd|rc|rcd|d\.)\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Los 19 rivales del DT: los otros clubes de su liga en leagues.js (la misma
// lista que alimenta el draft y los escudos). Con liga desconocida, Premier.
function candidatosRivales(club) {
  const liga = club.leagueId ? getLeagueById(club.leagueId) : null;
  const lista = (liga || getLeagueById(LIGA_FALLBACK)).clubs;
  const miId = club.id;
  const miNombre = normalizarNombreClub(club.name);
  return lista
    .filter((c) => (miId ? c.id !== miId : true) && normalizarNombreClub(c.name) !== miNombre)
    .map((c) => ({ id: c.id, nombre: c.name }));
}

/**
 * club: { id, name, leagueId } — el id es el slug de leagues.js (ej.
 * 'manchester-city'). El club del DT y cada rival llevan su `clubId` estable:
 * los tiers (TIER_LIGA) y los estilos (ESTILOS_CLUB) se resuelven por ese id,
 * nunca por el nombre mostrado.
 */
export function crearLiga(rng, club, { temporada = 1, posAnterior = null, ovrDT = null } = {}) {
  const media = ESCALADA_LIGA.BASE
    + ESCALADA_LIGA.POR_TEMPORADA * (temporada - 1)
    + (posAnterior && posAnterior <= 5 ? ESCALADA_LIGA.CASTIGO_AL_LIDER : 0)
    + (posAnterior && posAnterior >= 15 ? ESCALADA_LIGA.ALIVIO_AL_ULTIMO : 0);

  // Adaptive difficulty: si el plantel del DT supera claramente la media de la
  // liga (modo Global con ligas chicas), los rivales reciben un boost de fuerza.
  const { UMBRAL_DELTA, FACTOR, MAX_BOOST } = BOOST_RIVAL_GLOBAL;
  const mediaBoost = ovrDT !== null
    ? Math.min(MAX_BOOST, Math.max(0, (ovrDT - media - UMBRAL_DELTA) * FACTOR))
    : 0;

  const rivales = rng.shuffle(candidatosRivales(club)).slice(0, LIGA.EQUIPOS - 1);
  let equipos = [
    { id: 0, nombre: club.name, fuerza: 0, esMio: true, clubId: club.id || null },
    ...rivales.map((r, i) => {
      // Jerarquía real por club: cada rival saca su fuerza de la banda de su
      // tier (TIER_LIGA → FUERZA_POR_TIER). Las bandas son separadas a
      // propósito: los grandes pelean el título, los medios la mitad de la
      // tabla, los bajos el descenso.
      const cfg = FUERZA_POR_TIER[TIER_LIGA[r.id] ?? TIER_LIGA_DEFAULT];
      return {
        id: i + 1,
        clubId: r.id,
        nombre: r.nombre,
        fuerza: Math.round(clampNum(gauss(rng, media + cfg.off + mediaBoost, cfg.sd), 54, 90) * 10) / 10,
        esMio: false,
      };
    }),
  ];
  // El fixture se arma con la cantidad REAL de equipos. Bundesliga tiene 18,
  // no 20: si fijamos n=LIGA.EQUIPOS aparecen ids sin fila y simularTramo
  // explota al leer .esMio de undefined.
  if (equipos.length % 2 !== 0) equipos = equipos.slice(0, equipos.length - 1);
  const n = Math.max(2, equipos.length);
  return { equipos, fixture: generarFixture(rng, n), tabla: tablaVacia(equipos) };
}

function gauss(rng, media, sd) {
  const u = Math.max(1e-9, rng.next()), v = rng.next();
  return media + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clampNum = (v, a, b) => Math.max(a, Math.min(b, v));

/** Estilo de juego del rival por club_id (o nombre, caso legacy). Default implícito: club neutro. */
export function getEstiloRival(rival) {
  const key = typeof rival === 'string' ? rival : rival.clubId || rival.nombre;
  return ESTILOS_CLUB[key] ?? { goles_mod: 0, concedidos_mod: 0, presion_extra: 1 };
}

/** Round-robin (círculo) ida y vuelta: 2×(n−1) fechas. n tiene que ser par. */
function generarFixture(rng, n) {
  const ids = rng.shuffle([...Array(n).keys()]);
  const fechas = [];
  const rot = ids.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const ronda = [];
    const orden = [ids[0], ...rot];
    for (let i = 0; i < n / 2; i++) {
      const local = orden[i], visita = orden[n - 1 - i];
      ronda.push(r % 2 === 0 ? [local, visita] : [visita, local]);
    }
    fechas.push(ronda);
    rot.unshift(rot.pop());
  }
  const vuelta = fechas.map((ronda) => ronda.map(([l, v]) => [v, l]));
  return [...fechas, ...vuelta];
}

function tablaVacia(equipos) {
  return equipos.map((e) => ({ id: e.id, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }));
}

function goles(rng, fuerza, rival, localia, mod = 1) {
  const escala = fuerza < rival ? FUERZA.GOLES_ESCALA_INFERIOR : FUERZA.GOLES_ESCALA;
  const lambda = clampNum(
    FUERZA.GOLES_BASE * Math.exp((fuerza - rival) / escala) * localia * mod,
    0.15, 4.5,
  );
  return rng.poisson(lambda);
}

// Los rivales no tienen plantel simulado (solo un número de fuerza agregado),
// así que goleadores/asistencias solo se atribuyen a MI plantel — no hay
// jugadores reales del otro lado a los que asignarles el gol.
// DEL bajado de 6→3.8 y MED subido a 2.6: el goleador estrella deja de acaparar
// (~40%→~28% de los goles del equipo). En una temporada de ~60 goles, el pichichi
// suele quedar en 15-20 y llegar a 25 es la excepción, como en el fútbol real.
const PESO_GOL = { DEL: 3.8, MED: 2.6, DEF: 0.5, POR: 0.05 };
const PESO_ASISTENCIA = { DEL: 2, MED: 4, DEF: 1, POR: 0.05 };
const PROB_ASISTENCIA = 0.78; // el resto son goles individuales, de penal, etc.

function atribuirGol(rng, jugadores) {
  const autor = rng.weighted(jugadores, (j) => PESO_GOL[j.pos] ?? 1);
  const resto = jugadores.filter((j) => j.id !== autor.id);
  const asistente = resto.length && rng.next() < PROB_ASISTENCIA
    ? rng.weighted(resto, (j) => PESO_ASISTENCIA[j.pos] ?? 1)
    : null;
  return { autorId: autor.id, asistenteId: asistente?.id ?? null };
}

/**
 * Simula las fechas [desde, hasta) del tramo.
 * fuerzaMia se calcula fuera (depende del estado del DT) y entra como número.
 * misJugadores ({id,pos}[], el 11 titular confirmado) se usa solo para
 * repartir goles/asistencias de MIS goles entre mis jugadores.
 */
export function simularTramo(rng, liga, desde, hasta, fuerzaMia, misJugadores = [], opciones = {}) {
  const multGC = opciones.sinArquero ? FUERZA.SIN_ARQUERO_MULT_GC : 1;
  const misPartidos = [];
  const estadisticas = { goleadores: {}, asistencias: {} };
  const nFechas = liga.fixture?.length ?? 0;
  const fin = Math.min(hasta, nFechas);
  for (let f = desde; f < fin; f++) {
    const fecha = liga.fixture[f];
    if (!fecha) continue;
    for (const [localId, visitaId] of fecha) {
      const local = liga.equipos[localId], visita = liga.equipos[visitaId];
      if (!local || !visita) continue;
      const fl = (local.esMio ? fuerzaMia : local.fuerza) + gauss(rng, 0, 1.8);
      const fv = (visita.esMio ? fuerzaMia : visita.fuerza) + gauss(rng, 0, 1.8);
      let gl = goles(rng, fl, fv, FUERZA.LOCALIA);
      let gv = goles(rng, fv, fl, FUERZA.VISITA);
      // Estilo del rival: el fuerte te cierra (menos goles) y te castiga más (más en contra).
      if (local.esMio || visita.esMio) {
        const estilo = getEstiloRival(local.esMio ? visita : local);
        if (local.esMio) {
          gl = goles(rng, fl, fv, FUERZA.LOCALIA, 1 - estilo.goles_mod);
          gv = goles(rng, fv, fl, FUERZA.VISITA, 1 + estilo.concedidos_mod);
        } else {
          gl = goles(rng, fl, fv, FUERZA.LOCALIA, 1 + estilo.concedidos_mod);
          gv = goles(rng, fv, fl, FUERZA.VISITA, 1 - estilo.goles_mod);
        }
      }
      // Bug 2: sin arquero real en el arco propio, los goles CONCEDIDOS por mi
      // equipo se multiplican. Es aparte de la penalidad de rating: el efecto es
      // brutal (perdés 4-0 con un DEL entre los palos). Se aplica después del
      // ajuste por estilo del rival para no ser pisado.
      if (local.esMio) gv = Math.round(gv * multGC);
      if (visita.esMio) gl = Math.round(gl * multGC);
      anotar(liga.tabla, localId, gl, gv);
      anotar(liga.tabla, visitaId, gv, gl);
      if (local.esMio || visita.esMio) {
        const soyLocal = local.esMio;
        misPartidos.push({
          fecha: f + 1,
          rival: soyLocal ? visita.nombre : local.nombre,
          rivalId: soyLocal ? visita.clubId : local.clubId,
          localia: soyLocal ? 'L' : 'V',
          gf: soyLocal ? gl : gv,
          gc: soyLocal ? gv : gl,
          res: (soyLocal ? gl - gv : gv - gl) > 0 ? 'G' : (gl === gv ? 'E' : 'P'),
        });
        if (misJugadores.length) {
          const misGoles = soyLocal ? gl : gv;
          for (let i = 0; i < misGoles; i++) {
            const { autorId, asistenteId } = atribuirGol(rng, misJugadores);
            estadisticas.goleadores[autorId] = (estadisticas.goleadores[autorId] || 0) + 1;
            if (asistenteId) estadisticas.asistencias[asistenteId] = (estadisticas.asistencias[asistenteId] || 0) + 1;
          }
        }
      }
    }
  }
  return { partidos: misPartidos, estadisticas };
}

function anotar(tabla, id, gf, gc) {
  const t = tabla[id];
  t.pj++; t.gf += gf; t.gc += gc;
  if (gf > gc) { t.g++; t.pts += 3; } else if (gf === gc) { t.e++; t.pts++; } else { t.p++; }
}

export function posiciones(liga) {
  return liga.tabla
    .map((t) => ({ ...t, nombre: liga.equipos[t.id].nombre, dg: t.gf - t.gc }))
    .sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.id - b.id);
}

export function miPosicion(liga) {
  return posiciones(liga).findIndex((t) => t.id === MI_EQUIPO) + 1;
}

export function fuerzaDeEquipo(ratingOnce, estado, momentum) {
  return (
    ratingOnce
    + (estado.moral - 50) * FUERZA.PESO_MORAL
    - estado.fatiga * FUERZA.PESO_FATIGA
    - estado.presion * FUERZA.PESO_PRESION
    + momentum * FUERZA.PESO_MOMENTUM
    + estado.ratingDelta
  );
}
