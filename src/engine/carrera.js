// PURA. Orquestador del loop completo. Es la única memoria entre tramos.
// Máquina de fases: sobres → armar11 → tramo → evento → (…) → resumen → refuerzo → … → fin
import { createRng } from './rng.js';
import { CARRERA, TRAMO, TEMPORADA, LIGA, DESPIDO } from './balance.js';
import { createEstado, aplicarEfectos, resetRatingDelta } from './state.js';
import { crearLiga, simularTramo, miPosicion, posiciones, fuerzaDeEquipo } from './liga.js';
import { ratingOnce, autoOnce, onceCompleto } from './once.js';
import { sobresIniciales, sobreRefuerzo } from './sobresLocal.js';
import { cargarCartasDB, envejecerPlantel, valorDeVenta } from './cartas.js';
import { candidatosEvento, efectosDeOpcion, elegirPorSorteo } from './candidatosEvento.js';

export const FASES = {
  SOBRES: 'sobres', ONCE: 'once', TRAMO: 'tramo', EVENTO: 'evento',
  RESUMEN: 'resumen', REFUERZO: 'refuerzo', FIN: 'fin',
};

const limitesTramo = (() => {
  const out = []; let acc = 0;
  for (const n of LIGA.TRAMOS) { out.push([acc, acc + n]); acc += n; }
  return out;
})();

/**
 * Hidrata el estado del motor a partir de las tablas de Supabase.
 * managerDB: fila de la tabla managers
 * plantelDB: filas resultantes de user_cards + cards
 * temporadasDB: historial de la tabla seasons
 */
export function cargarCarrera(managerDB, plantelDB, temporadasDB = []) {
  const seed = managerDB.seed || Date.now();
  const rng = createRng(seed); // Seteas la seed guardada
  
  if (managerDB.rng_state) {
     rng.state = managerDB.rng_state; // Retomás el RNG exacto donde quedó
  }

  // Mapeamos el estado puro leyendo las columnas
  const estado = {
    money: managerDB.money,
    moral: managerDB.moral,
    fatiga: managerDB.fatiga,
    presion: managerDB.presion,
    ratingDelta: managerDB.rating_delta || 0
  };

  return {
    seed, 
    rng, 
    dt: managerDB.dt_name || 'DT', 
    club: managerDB.club_id || 'Club Atlético Viedma',
    fase: managerDB.fase_actual || FASES.ONCE,
    temporada: managerDB.temporada_actual || 1,
    tramo: managerDB.tramo_actual || 0,
    estado,
    plantel: plantelDB, // Ya formateado por cartas.js
    once: managerDB.once_ids || [], // Recuperar los IDs del 11 titular
    liga: managerDB.liga_snapshot || null,
    objetivo: managerDB.objetivo_temporada || TEMPORADA.OBJETIVO_INICIAL,
    momentum: managerDB.momentum || 0,
    partidosTemporada: managerDB.partidos_log || [],
    ultimoTramo: managerDB.ultimo_tramo_log || null,
    eventoActual: managerDB.evento_pendiente || null,
    historialEventos: managerDB.eventos_vistos || [],
    historial: [],
    temporadas: temporadasDB,
    titulos: managerDB.titulos || 0,
    motivoFin: managerDB.motivo_fin || null,
  };
}

export function iniciarCarrera({
  seed = Date.now(), dt = 'DT', club = 'Club Atlético Viedma', cartasInicialesDB = null,
} = {}) {
  const rng = createRng(seed);
  // Sobres iniciales: los inyecta la UI desde Supabase (open_pack) o, si vienen
  // vacíos/nulos, se resuelven con el fallback local — la carrera nunca se traba.
  const sobres = cartasInicialesDB?.length
    ? cartasInicialesDB.map((s) => cargarCartasDB(s))
    : sobresIniciales(rng).map((s) => cargarCartasDB(s));
  return {
    seed, rng, dt, club,
    fase: FASES.SOBRES,
    temporada: 1,
    tramo: 0,
    estado: createEstado(),
    plantel: sobres.flat(),
    sobresIniciales: sobres,
    once: [],
    liga: null,
    objetivo: TEMPORADA.OBJETIVO_INICIAL,
    momentum: 0,
    partidosTemporada: [],
    ultimoTramo: null,
    eventoActual: null,
    historialEventos: [],
    historial: [],           // log de mutaciones, para el harness
    temporadas: [],          // SNAPSHOTS de temporadas cerradas (§2.5)
    titulos: 0,
    motivoFin: null,
  };
}

export function confirmarOnce(c, once) {
  const elegido = once && onceCompleto(once) ? once : autoOnce(c.plantel);
  c.once = elegido;
  if (!c.liga) c.liga = crearLiga(c.rng, c.club);
  c.fase = FASES.TRAMO;
  return c;
}

export function ratingActual(c) {
  return ratingOnce(c.once, c.plantel);
}

export function contexto(c) {
  return {
    dt: c.dt, club: c.club, temporada: c.temporada, tramo: c.tramo,
    posicion: c.liga ? miPosicion(c.liga) : 20,
    racha: racha(c.partidosTemporada),
    plantel: c.plantel,
    once: c.once,
    figura: figuraDelPlantel(c),
    rival: proximoRival(c),
    ...c.estado,
    modificadorTramo: c.modificadorTramo || null,
  };
}

/** El jugador de mayor rating en el 11 titular actual — el que un evento "de figura" debe nombrar. */
function figuraDelPlantel(c) {
  if (!c.once?.length) return null;
  const porId = new Map(c.plantel.map((x) => [x.id, x]));
  return c.once.map((id) => porId.get(id)).filter(Boolean).sort((a, b) => b.rating - a.rating)[0] || null;
}

/** Primer rival del tramo que arranca ahora — para eventos tácticos pre-partido. */
function proximoRival(c) {
  if (!c.liga) return null;
  const [desde] = limitesTramo[c.tramo] || [];
  if (desde === undefined) return null;
  const fecha = c.liga.fixture[desde];
  if (!fecha) return null;
  const par = fecha.find(([l, v]) => l === 0 || v === 0);
  if (!par) return null;
  const [l, v] = par;
  const soyLocal = l === 0;
  const rival = c.liga.equipos[soyLocal ? v : l];
  return { nombre: rival.nombre, localia: soyLocal ? 'L' : 'V' };
}

function racha(partidos) {
  const ult = partidos.slice(-5);
  if (ult.length < 3) return 'neutra';
  const pts = ult.reduce((s, p) => s + (p.res === 'G' ? 3 : p.res === 'E' ? 1 : 0), 0);
  return pts >= 11 ? 'buena' : pts <= 4 ? 'mala' : 'neutra';
}

/** Juega el tramo actual y deja la carrera en fase EVENTO. */
export function jugarTramo(c) {
  const [desde, hasta] = limitesTramo[c.tramo];
  let fuerza = fuerzaDeEquipo(ratingActual(c), c.estado, c.momentum);
  if (c.modificadorTramo?.fuerza) fuerza += c.modificadorTramo.fuerza;
  const partidos = simularTramo(c.rng, c.liga, desde, hasta, fuerza);
  c.partidosTemporada.push(...partidos);
  c.modificadorTramo = null; // el efecto dura un solo tramo, nunca se acumula

  const pts = partidos.reduce((s, p) => s + (p.res === 'G' ? 3 : p.res === 'E' ? 1 : 0), 0);
  const ppp = pts / partidos.length;
  const pos = miPosicion(c.liga);

  const efectos = {
    fatiga: TRAMO.FATIGA_POR_TRAMO,
    money: TRAMO.INGRESO_NETO,
    moral: redondear(TRAMO.MORAL_POR_RENDIMIENTO * (ppp - 1.35)) + driftMoral(c.estado.moral),
    presion: redondear(-TRAMO.PRESION_POR_RENDIMIENTO * (ppp - 1.35))
      + (pos > c.objetivo ? TRAMO.PRESION_OBJETIVO_LEJOS : TRAMO.PRESION_OBJETIVO_CERCA),
  };

  const r = aplicarEfectos(c.estado, efectos, `tramo-t${c.temporada}-${c.tramo + 1}`, c.historial);
  c.estado = r.estado;
  c.momentum = Math.max(-3, Math.min(3, Math.round((pts - partidos.length * 1.35) / 1.5)));
  c.ultimoTramo = { partidos, pts, ppp, posicion: pos, deltas: r.deltas };

  if (c.estado.presion >= DESPIDO.PRESION) return terminarCarrera(c, 'despedido');
  c.fase = FASES.EVENTO;
  return c;
}

function driftMoral(moral) {
  // Aditivo y acotado: nunca multiplicativo (así no se forma el 'pozo gravitacional').
  if (moral === 50) return 0;
  const d = Math.abs(moral - 50);
  const fuerza = d >= 30 ? 3 : d >= 20 ? TRAMO.MORAL_DRIFT_A_50 : 1;
  return moral > 50 ? -fuerza : fuerza;
}
const redondear = (v) => Math.round(v * 10) / 10;

/** Devuelve los 4-6 candidatos del punto de decisión (para IA o para sorteo). */
export function candidatosDelTramo(c) {
  const cand = candidatosEvento(c.rng, contexto(c), c.historialEventos);
  c.eventoActual = { candidatos: cand, narracion: null };
  return cand;
}

/** Narración: la elige la IA (validada afuera) o el sorteo ponderado local. */
export function fijarNarracion(c, narracion) {
  if (!c.eventoActual) candidatosDelTramo(c);
  const valida = narracion
    && c.eventoActual.candidatos.some((x) => x.id === narracion.paqueteId);
  c.eventoActual.narracion = valida
    ? narracion
    : elegirPorSorteo(c.rng, c.eventoActual.candidatos, contexto(c));
  return c.eventoActual.narracion;
}

/** Resuelve el evento: los efectos SIEMPRE salen del catálogo por id (§ rama probabilística la sortea acá, con c.rng). */
export function resolverEvento(c, opcionId) {
  const n = c.eventoActual?.narracion;
  if (!n) throw new Error('resolverEvento sin narración fijada');
  const opcion = efectosDeOpcion(c.rng, n.paqueteId, opcionId);
  const motivo = `evento-${n.paqueteId}-${opcionId}` + (opcion.rama ? ` (${opcion.rama})` : '');
  const r = aplicarEfectos(c.estado, opcion.efectos, motivo, c.historial);
  c.estado = r.estado;
  // Efectos que no son del estado global sino del PRÓXIMO tramo únicamente (§ táctica pre-partido).
  c.modificadorTramo = opcion.tramo ? { ...opcion.tramo } : null;
  c.historialEventos.push({ id: n.paqueteId, temporada: c.temporada });
  c.eventoActual = null;

  if (c.estado.presion >= DESPIDO.PRESION) return { carrera: terminarCarrera(c, 'despedido'), deltas: r.deltas };

  c.tramo++;
  if (c.tramo >= LIGA.TRAMOS.length) cerrarTemporada(c);
  else c.fase = FASES.TRAMO;
  return { carrera: c, deltas: r.deltas };
}

function cerrarTemporada(c) {
  const tabla = posiciones(c.liga);
  const pos = tabla.findIndex((t) => t.id === 0) + 1;
  const mia = tabla[pos - 1];
  const campeon = pos === 1;
  const cumplio = pos <= c.objetivo;

  const efectos = {
    money: redondear((21 - pos) * TEMPORADA.PREMIO_BASE),
    fatiga: TEMPORADA.DESCANSO_FATIGA,
    presion: (cumplio ? TEMPORADA.PRESION_OBJETIVO_CUMPLIDO : TEMPORADA.PRESION_OBJETIVO_FALLADO)
      + TEMPORADA.PRESION_EXPECTATIVA_POR_TEMPORADA * c.temporada,
    moral: campeon ? TEMPORADA.MORAL_TITULO : (cumplio ? 3 : -6),
  };
  const r = aplicarEfectos(c.estado, efectos, `cierre-t${c.temporada}`, c.historial);
  c.estado = resetRatingDelta(r.estado);

  if (campeon) c.titulos++;

  // SNAPSHOT: foto del momento, nunca se recalcula.
  c.temporadas.push({
    temporada: c.temporada, posicion: pos, pts: mia.pts, g: mia.g, e: mia.e, p: mia.p,
    gf: mia.gf, gc: mia.gc, objetivo: c.objetivo, cumplio, campeon,
    ratingOnceSnapshot: ratingActual(c),
    tablaTop5: tabla.slice(0, 5).map((t) => ({ nombre: t.nombre, pts: t.pts })),
  });

  c.ultimaTemporada = c.temporadas[c.temporadas.length - 1];

  if (c.estado.presion >= DESPIDO.PRESION) { terminarCarrera(c, 'despedido'); return c; }
  if (c.temporada >= CARRERA.TEMPORADAS) { terminarCarrera(c, 'contrato-cumplido'); return c; }

  c.fase = FASES.RESUMEN;
  return c;
}

/** Bisagra entre loop corto y loop largo: el sobre de refuerzo. */
export function abrirRefuerzo(c) {
  const cartas = cargarCartasDB(sobreRefuerzo(c.rng, c.ultimaTemporada.posicion));
  c.refuerzo = cartas;
  c.fase = FASES.REFUERZO;
  return cartas;
}

/** 
 * cartasCrudasDB es el array que te devolvió supabase.rpc('open_pack')
 */
export function registrarRefuerzo(c, cartasCrudasDB) {
  // Mismo formateo que abrirRefuerzo: el motor SIEMPRE guarda cartas con
  // shape {id, nombre, pos, rating, edad, rareza}, nunca columnas DB crudas.
  c.refuerzo = cargarCartasDB(cartasCrudasDB);
  c.fase = FASES.REFUERZO;
  return c.refuerzo;
}

export function aplicarRefuerzo(c, idsEntran = [], idsSalen = []) {
  const entran = (c.refuerzo || []).filter((x) => idsEntran.includes(x.id));
  const salen = c.plantel.filter((x) => idsSalen.includes(x.id));
  const ingreso = salen.reduce((s, x) => s + valorDeVenta(x), 0);
  
  c.plantel = c.plantel.filter((x) => !idsSalen.includes(x.id)).concat(entran);
  
  if (c.plantel.length > CARRERA.PLANTEL_MAX) {
    const orden = [...c.plantel].sort((a, b) => a.rating - b.rating);
    const sobran = c.plantel.length - CARRERA.PLANTEL_MAX;
    const fuera = new Set(orden.slice(0, sobran).map((x) => x.id));
    c.plantel = c.plantel.filter((x) => !fuera.has(x.id));
  }
  
  if (ingreso > 0) {
    const r = aplicarEfectos(c.estado, { money: ingreso }, 'venta-refuerzo', c.historial);
    c.estado = r.estado;
  }
  
  c.plantel = envejecerPlantel(c.rng, c.plantel);
  c.temporada++;
  c.tramo = 0;
  
  const pos = c.ultimaTemporada ? c.ultimaTemporada.posicion : 10;
  const apriete = pos <= 5 ? 1 : TEMPORADA.OBJETIVO_APRIETE;
  c.objetivo = Math.max(TEMPORADA.OBJETIVO_PISO, Math.min(14, pos - apriete));
  
  c.partidosTemporada = [];
  c.momentum = 0;
  c.refuerzo = null;
  c.liga = crearLiga(c.rng, c.club, { temporada: c.temporada, posAnterior: pos });
  c.once = autoOnce(c.plantel);
  c.fase = FASES.ONCE;
  
  return c;
}

function terminarCarrera(c, motivo) {
  c.fase = FASES.FIN;
  c.motivoFin = motivo;
  return c;
}

export function resumenCarrera(c) {
  const mejor = c.temporadas.reduce((m, t) => (m === null || t.posicion < m ? t.posicion : m), null);
  return {
    dt: c.dt, club: c.club, motivoFin: c.motivoFin,
    temporadasJugadas: c.temporadas.length,
    titulos: c.titulos,
    mejorPosicion: mejor,
    posicionPromedio: c.temporadas.length
      ? Math.round((c.temporadas.reduce((s, t) => s + t.posicion, 0) / c.temporadas.length) * 10) / 10
      : null,
    estadoFinal: c.estado,
  };
}
