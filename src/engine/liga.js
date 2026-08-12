// PURA. Resolución de temporada por tramos (§2.2): sin motor de partido en vivo.
import { LIGA, FUERZA, ESCALADA_LIGA, ESTILOS_CLUB, TIER_LIGA, TIER_LIGA_DEFAULT, FUERZA_POR_TIER } from './balance.js';
import { CLUBES_RIVALES } from '../data/nombres.js';

export const MI_EQUIPO = 0;

export function crearLiga(rng, nombreClub, { temporada = 1, posAnterior = null } = {}) {
  const media = ESCALADA_LIGA.BASE
    + ESCALADA_LIGA.POR_TEMPORADA * (temporada - 1)
    + (posAnterior && posAnterior <= 5 ? ESCALADA_LIGA.CASTIGO_AL_LIDER : 0)
    + (posAnterior && posAnterior >= 15 ? ESCALADA_LIGA.ALIVIO_AL_ULTIMO : 0);
  const rivales = rng.shuffle(CLUBES_RIVALES).slice(0, LIGA.EQUIPOS - 1);
  const equipos = [
    { id: 0, nombre: nombreClub, fuerza: 0, esMio: true },
    ...rivales.map((nombre, i) => {
      // Jerarquía real por club: cada rival saca su fuerza de la banda de su
      // tier (TIER_LIGA → FUERZA_POR_TIER). Las bandas son separadas a
      // propósito: los grandes pelean el título, los medios la mitad de la
      // tabla, los bajos el descenso. Antes todos sacaban de la misma gauss
      // y un equipo de mitad/baja tabla podía salir campeón.
      const cfg = FUERZA_POR_TIER[TIER_LIGA[nombre] ?? TIER_LIGA_DEFAULT];
      return {
        id: i + 1,
        nombre,
        fuerza: Math.round(clampNum(gauss(rng, media + cfg.off, cfg.sd), 54, 90) * 10) / 10,
        esMio: false,
      };
    }),
  ];
  return { equipos, fixture: generarFixture(rng, LIGA.EQUIPOS), tabla: tablaVacia(equipos) };
}

function gauss(rng, media, sd) {
  const u = Math.max(1e-9, rng.next()), v = rng.next();
  return media + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clampNum = (v, a, b) => Math.max(a, Math.min(b, v));

/** Estilo de juego del rival por nombre. Default implícito: club neutro. */
export function getEstiloRival(nombreRival) {
  return ESTILOS_CLUB[nombreRival] ?? { goles_mod: 0, concedidos_mod: 0, presion_extra: 1 };
}

/** Round-robin (círculo) ida y vuelta: 38 fechas para 20 equipos. */
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
const PESO_GOL = { DEL: 6, MED: 2, DEF: 0.4, POR: 0.05 };
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
export function simularTramo(rng, liga, desde, hasta, fuerzaMia, misJugadores = []) {
  const misPartidos = [];
  const estadisticas = { goleadores: {}, asistencias: {} };
  for (let f = desde; f < hasta; f++) {
    for (const [localId, visitaId] of liga.fixture[f]) {
      const local = liga.equipos[localId], visita = liga.equipos[visitaId];
      const fl = (local.esMio ? fuerzaMia : local.fuerza) + gauss(rng, 0, 1.2);
      const fv = (visita.esMio ? fuerzaMia : visita.fuerza) + gauss(rng, 0, 1.2);
      let gl = goles(rng, fl, fv, FUERZA.LOCALIA);
      let gv = goles(rng, fv, fl, FUERZA.VISITA);
      // Estilo del rival: el fuerte te cierra (menos goles) y te castiga más (más en contra).
      if (local.esMio || visita.esMio) {
        const estilo = getEstiloRival((local.esMio ? visita : local).nombre);
        if (local.esMio) {
          gl = goles(rng, fl, fv, FUERZA.LOCALIA, 1 - estilo.goles_mod);
          gv = goles(rng, fv, fl, FUERZA.VISITA, 1 + estilo.concedidos_mod);
        } else {
          gl = goles(rng, fl, fv, FUERZA.LOCALIA, 1 + estilo.concedidos_mod);
          gv = goles(rng, fv, fl, FUERZA.VISITA, 1 - estilo.goles_mod);
        }
      }
      anotar(liga.tabla, localId, gl, gv);
      anotar(liga.tabla, visitaId, gv, gl);
      if (local.esMio || visita.esMio) {
        const soyLocal = local.esMio;
        misPartidos.push({
          fecha: f + 1,
          rival: soyLocal ? visita.nombre : local.nombre,
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
