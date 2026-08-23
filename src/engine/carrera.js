// PURA. Orquestador del loop completo. Es la única memoria entre tramos.
// Máquina de fases: sobres → armar11 → tramo → evento → (…) → resumen → refuerzo → … → fin
import { createRng } from './rng.js';
import { FORMACIONES_SLOTS, FORMACION } from '../data/posiciones.js';
import { CARRERA, TRAMO, TEMPORADA, LIGA, FUERZA_POR_TIER, TIER_LIGA, TIER_LIGA_DEFAULT, DESPIDO, MODO, MODO_JUEGO, BUDGET, DIFICULTAD, PRESION_DIFICIL, EPICAS_DIFICIL, PRESION_INICIAL_TIER, PRESION_INICIAL_DIFICIL_DEFAULT, ROTACION_PLANTEL } from './balance.js';
import { createEstado, aplicarEfectos, resetRatingDelta } from './state.js';
import { crearLiga, simularTramo, miPosicion, posiciones, fuerzaDeEquipo, getEstiloRival } from './liga.js';
import { ratingOnce, autoOnce, onceCompleto } from './once.js';
import { sobresIniciales, sobreRefuerzo } from './sobresLocal.js';
import { cargarCartasDB, envejecerPlantel, valorDeVenta } from './cartas.js';
import { candidatosEvento, efectosDeOpcion, elegirPorSorteo, figuraConRotacion, figurasRecientes, jugadorAleatorioDelOnce } from './candidatosEvento.js';
import { paquete, CATALOGO_GRAVES } from './catalogoEventos.js';
import { getClubById, findClubIdByName, getLeagueByClubName } from '../data/leagues.js';

const fSlots = (key) => FORMACIONES_SLOTS[key] || FORMACION;

export const FASES = {
  SOBRES: 'sobres', ONCE: 'once', TRAMO: 'tramo', EVENTO: 'evento',
  LESION: 'lesion', RESUMEN: 'resumen', REFUERZO: 'refuerzo', FIN: 'fin',
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

  // Identidad del club: resolvemos el nombre estable a partir de los ids
  // persistidos (league_id / club_id de leagues.js). Managers viejos con
  // club_id foráneo (la tabla `clubs` UUID) quedan con ese id como nombre:
  // el motor igual los hace jugar en la arena (liga.js usa la Premier real
  // como fallback cuando no hay liga).
  const clubId = managerDB.club_id || null;
  const leagueId = managerDB.league_id || null;
  const clubInfo = clubId && leagueId ? getClubById(leagueId, clubId) : null;

  return {
    seed, 
    rng, 
    dt: managerDB.dt_name || 'DT', 
    club: clubInfo?.name ?? clubId ?? 'Club Atlético Viedma',
    clubId,
    leagueId,
    modo: managerDB.modo || MODO.FACIL,
    fase: managerDB.fase_actual || FASES.ONCE,
    temporada: managerDB.temporada_actual || 1,
    tramo: managerDB.tramo_actual || 0,
    estado,
    plantel: plantelDB, // Ya formateado por cartas.js
    formacion: managerDB.formacion || '4-3-3',
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
    estadisticas: managerDB.estadisticas_temporada || { goleadores: {}, asistencias: {} },
  };
}

export function iniciarCarrera({
  seed = Date.now(), dt = 'DT', club = 'Club Atlético Viedma', cartasInicialesDB = null, modo = MODO.FACIL,
  leagueId = null, clubId = null, modoJuego = MODO_JUEGO.LIGA, formacion = '4-3-3',
  plantelBase = null, // Club Real: plantilla oficial ya normalizada; cartasInicialesDB = 1 sobre de refuerzo
} = {}) {
  const rng = createRng(seed);

  // Modo Club Real: plantelBase trae el plantel del club real ya normalizado.
  // cartasInicialesDB contiene solo el sobre de refuerzo (1 pack de 5 cartas).
  let sobres, plantelFinal;
/* Implementación de getJugadorPorId */

function getJugadorPorId(id) {
  // Buscamos en el plantel actual
  return ui.onboarding.clubes.find(club => {
    const jugador = club.jugadores.find(j => j.id === id);
    if (jugador) return jugador;
  });
}


  if (plantelBase?.length) {
    sobres = cartasInicialesDB?.length
      ? cartasInicialesDB.map((s) => cargarCartasDB(s))
      : [[]];
    plantelFinal = [...plantelBase.map((c) => ({ ultimoDelta: 0, ...c, edad: c.date_of_birth ? Math.floor((Date.now() - new Date(c.date_of_birth).getTime()) / 31557600000) : (c.edad || 24) })), ...sobres.flat()];
  } else {
    // Sobres iniciales: los inyecta la UI desde Supabase (openInitialPacks) o fallback local.
    sobres = cartasInicialesDB?.length
      ? cartasInicialesDB.map((s) => cargarCartasDB(s))
      : sobresIniciales(rng).map((s) => cargarCartasDB(s));
    plantelFinal = sobres.flat();
  }

  // El id estable del club (slug de leagues.js) manda para tiers, presión
  // inicial y arena. Si solo llega el nombre (callers legacy), lo resolvemos
  // contra leagues.js; si no es un club real, se conserva el nombre y la
  // arena cae al fallback de liga.js.
  const clubIdFinal = clubId || findClubIdByName(club) || club;
  const leagueIdFinal = leagueId || getLeagueByClubName(club)?.id || null;

  // En modo difícil: la presión inicial depende del peso del club
  const presionInicial = modo === MODO.DIFICIL
    ? (PRESION_INICIAL_TIER[clubIdFinal] ?? PRESION_INICIAL_DIFICIL_DEFAULT)
    : undefined;

  const estadoOverrides = {
    ...(presionInicial !== undefined ? { presion: presionInicial } : {}),
    ...(modoJuego === MODO_JUEGO.BUDGET ? { money: BUDGET.MONEY_INICIAL } : {}),
  };

  return {
    seed, rng, dt, club, clubId: clubIdFinal, leagueId: leagueIdFinal, modo, modoJuego, formacion,
    fase: FASES.SOBRES,
    temporada: 1,
    tramo: 0,
    estado: createEstado(estadoOverrides),
    plantel: plantelFinal,
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
    estadisticas: { goleadores: {}, asistencias: {} }, // se resetea cada temporada
  };
}

export function confirmarOnce(c, once) {
  const slots = fSlots(c.formacion);
  const elegido = once && onceCompleto(once, slots) ? once : autoOnce(c.plantel, { formacion: slots });
  c.once = elegido;
  if (!c.liga) {
    const ovrDT = c.plantel.length
      ? Math.round(c.plantel.reduce((s, j) => s + j.rating, 0) / c.plantel.length)
      : null;
    c.liga = crearLiga(c.rng, { id: c.clubId || null, name: c.club, leagueId: c.leagueId || null }, { ovrDT });
  }
  c.fase = FASES.TRAMO;
  return c;
}

export function ratingActual(c) {
  return ratingOnce(c.once, c.plantel, fSlots(c.formacion));
}

export function contexto(c) {
  return {
    dt: c.dt, club: c.club, temporada: c.temporada, tramo: c.tramo,
    posicion: c.liga ? miPosicion(c.liga) : 20,
    racha: racha(c.partidosTemporada),
    plantel: c.plantel,
    once: c.once,
    figura: figuraDelPlantel(c),
    figurasRecientes: figurasRecientes(c.historialEventos),
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
  const porId = new Map(c.plantel.map((x) => [x.id, x]));

  // Modo difícil: las épicas en el 11 amplían (o limitan) la fuerza real del equipo.
  // Sin épicas: el techo de rendimiento baja. Con épicas: pequeño bonus acumulativo.
  if (c.modo === MODO.DIFICIL) {
    const epicasEnXI = c.once.filter((id) => porId.get(id)?.rareza === 'epica').length;
    fuerza += epicasEnXI === 0
      ? EPICAS_DIFICIL.SIN_EPICAS_MOD
      : Math.min(epicasEnXI, EPICAS_DIFICIL.MAX_EPICAS) * EPICAS_DIFICIL.CON_EPICA_BONUS;
  }

  const misJugadores = c.once.map((id) => porId.get(id)).filter(Boolean).map((x) => ({ id: x.id, pos: x.pos }));
  // Bug 2: si el slot de ARQ (once[0]) no está ocupado por un POR de verdad,
  // el equipo entra sin arquero real → la simulación multiplica los goles en contra.
  const arqCarta = porId.get(c.once[0]);
  const sinArquero = !arqCarta || arqCarta.pos !== 'POR';
  const { partidos, estadisticas } = simularTramo(c.rng, c.liga, desde, hasta, fuerza, misJugadores, { sinArquero });
  c.partidosTemporada.push(...partidos);
  acumularEstadisticas(c, estadisticas);

  // 🟨 Presión por brecha de posición al objective
  const brecha = miPosicion(c.liga) - c.objetivo;
  if (brecha > 0) {
    c.estado.presion += brecha * TRAMO.PRESION_BRECHA;
  }
  // Clamp a [0, 100] per arquitectura
  if (c.estado.presion > 100) c.estado.presion = 100;
  if (c.estado.presion < 0) c.estado.presion = 0;

  c.modificadorTramo = null; // el efecto dura un solo tramo, nunca se acumula

  const pts = partidos.reduce((s, p) => s + (p.res === 'G' ? 3 : p.res === 'E' ? 1 : 0), 0);
  const ppp = pts / partidos.length;
  const pos = miPosicion(c.liga);

  // Impuesto fisico por hazana: robarle puntos a un grande cansa. Cobra por cada
  // partido contra un tier alto (off > 0, ver FUERZA_POR_TIER) donde sacamos puntos.
  const impuestoHazana = partidos.reduce((s, p) => {
    if (p.res === 'P') return s;
    const off = FUERZA_POR_TIER[TIER_LIGA[p.rivalId] ?? TIER_LIGA_DEFAULT].off;
    return off > 0 ? s + TRAMO.FATIGA_HAZANA : s;
  }, 0);

  const efectos = {
    fatiga: TRAMO.FATIGA_POR_TRAMO + impuestoHazana,
    money: TRAMO.INGRESO_NETO,
    moral: redondear(TRAMO.MORAL_POR_RENDIMIENTO * (ppp - 1.35)) + driftMoral(c.estado.moral),
    presion: redondear(-TRAMO.PRESION_POR_RENDIMIENTO * (ppp - 1.35))
      + (pos > c.objetivo ? TRAMO.PRESION_OBJETIVO_LEJOS : TRAMO.PRESION_OBJETIVO_CERCA)
      + presionExtraDerrotas(partidos),
  };

  const r = aplicarEfectos(c.estado, efectos, `tramo-t${c.temporada}-${c.tramo + 1}`, c.historial);
  c.estado = r.estado;
  c.momentum = Math.max(-3, Math.min(3, Math.round((pts - partidos.length * 1.35) / 1.5)));
  c.ultimoTramo = { partidos, pts, ppp, posicion: pos, deltas: r.deltas };

  if (c.estado.presion >= DESPIDO.PRESION) return terminarCarrera(c, 'despedido');
  c.fase = FASES.EVENTO;
  return c;
}

/** Suma los goles/asistencias del tramo al acumulado de la temporada (§ goleadores). */
function acumularEstadisticas(c, delTramo) {
  for (const [id, n] of Object.entries(delTramo.goleadores)) {
    c.estadisticas.goleadores[id] = (c.estadisticas.goleadores[id] || 0) + n;
  }
  for (const [id, n] of Object.entries(delTramo.asistencias)) {
    c.estadisticas.asistencias[id] = (c.estadisticas.asistencias[id] || 0) + n;
  }
}

/** Presión extra por perder contra rivales de peso (ESTILOS_CLUB.presion_extra). */
function presionExtraDerrotas(partidos) {
  return partidos.reduce((s, p) => (p.res === 'P' ? s + getEstiloRival({ clubId: p.rivalId, nombre: p.rival }).presion_extra : s), 0);
}

function driftMoral(moral) {
  // Aditivo y acotado: nunca multiplicativo (así no se forma el 'pozo gravitacional').
  if (moral === 50) return 0;
  const d = Math.abs(moral - 50);
  const fuerza = d >= 30 ? 3 : d >= 20 ? TRAMO.MORAL_DRIFT_A_50 : 1;
  return moral > 50 ? -fuerza : fuerza;
}
const redondear = (v) => Math.round(v * 10) / 10;

/** Devuelve los candidatos del punto de decisión. En modo difícil puede ser un evento grave (forzado). */
export function candidatosDelTramo(c) {
  const ctx = contexto(c);

  // Modo difícil: 30% de chance de que el tramo abra con un evento grave (sin elección).
  if (c.modo === MODO.DIFICIL && CATALOGO_GRAVES.length) {
    const usadaAlgunaVez = (id) => c.historialEventos.some((h) => h.id === id);
    const usosEnTemp = (id) => c.historialEventos.filter((h) => h.id === id && h.temporada === c.temporada).length;
    const elegiblesGraves = CATALOGO_GRAVES.filter((e) => {
      if (e.intensidad === 'alta' && usadaAlgunaVez(e.id)) return false;
      if (e.intensidad === 'media' && usosEnTemp(e.id) > 0) return false;
      if (e.intensidad === 'baja' && usosEnTemp(e.id) >= 3) return false;
      return e.filtro(ctx);
    });
    if (elegiblesGraves.length && c.rng.next() < DIFICULTAD.PROB_GRAVE_POR_TRAMO) {
      const graveEvento = c.rng.weighted(elegiblesGraves);
      // Los graves individuales (lesión/suspensión de la figura) apuntaban SIEMPRE
      // a la misma estrella (ctx.figura). Rotación sobre el XI: el objetivo se
      // sortea evitando las últimas figuras nombradas, así la baja no recae
      // siempre en el mismo jugador. Ver figuraConRotacion + figurasRecientes.
      // EXCEPCIÓN: lesion_figura_prePartido usa sorteo UNIFORME sobre el XI (sin rotación),
      // y solo dispara si fatiga >= 65 (ver filtro en catalogoEventos.js).
      let candidatoGrave = graveEvento;
      if (graveEvento.tags?.includes('individual')) {
        const porId = new Map(c.plantel.map((x) => [x.id, x]));
        const onceCards = c.once.map((id) => porId.get(id)).filter(Boolean);
        let objetivo;
        if (graveEvento.id === 'lesion_figura_prePartido') {
          objetivo = jugadorAleatorioDelOnce(c.rng, onceCards);
        } else {
          objetivo = figuraConRotacion(c.rng, onceCards, figurasRecientes(c.historialEventos));
        }
        candidatoGrave = { ...graveEvento, figura: objetivo };
      }
      // Narración fijada desde el catálogo — no pasa por IA
      const narracion = elegirPorSorteo(c.rng, [candidatoGrave], ctx);
      c.eventoActual = { candidatos: [candidatoGrave], narracion };
      return [candidatoGrave];
    }
  }

  const cand = candidatosEvento(c.rng, ctx, c.historialEventos);
  c.eventoActual = { candidatos: cand, narracion: null };
  return cand;
}

/** Narración: la elige la IA (validada afuera) o el sorteo ponderado local. */
export function fijarNarracion(c, narracion) {
  if (!c.eventoActual) candidatosDelTramo(c);
  // Evento grave: la narración fue fijada por el motor al detectar el grave. No pisar.
  if (c.eventoActual.narracion) return c.eventoActual.narracion;
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

  // Modo difícil: la presión de cada evento narrativo (no grave) se escala simétricamente.
  // Eventos graves ya tienen efectos calibrados, no se tocan.
  const efectos = (c.modo === MODO.DIFICIL && !paquete(n.paqueteId).grave)
    ? escalarPresionDificil(opcion.efectos)
    : opcion.efectos;

  const r = aplicarEfectos(c.estado, efectos, motivo, c.historial);
  c.estado = r.estado;
  // Efectos que no son del estado global sino del PRÓXIMO tramo únicamente (§ táctica pre-partido).
  c.modificadorTramo = opcion.tramo ? { ...opcion.tramo } : null;
  // Memoria de rotación de figuras: guardamos el id de la figura nombrada en
  // eventos VISIBLES (individuales y graves). Retrocompatible: los eventos
  // viejos de la DB no traen `figura` y se ignoran en figurasRecientes.
  const elegido = c.eventoActual.candidatos.find((x) => x.id === n.paqueteId);
  const figuraDelEventoResuelto = elegido?.tags?.includes('individual')
    ? (elegido.figura?.id ?? null)
    : null;
  c.historialEventos.push({ id: n.paqueteId, temporada: c.temporada, figura: figuraDelEventoResuelto });

  // Si el evento grave requiere reemplazo (lesion_figura_prePartido), ir a fase LESION
  const paqueteEvento = paquete(n.paqueteId);
  if (paqueteEvento.requiereReemplazo && elegido?.figura?.id) {
    c.lesionadoId = elegido.figura.id;
    c.eventoActual = null;
    c.fase = FASES.LESION;
    return { carrera: c, deltas: r.deltas };
  }

  c.eventoActual = null;

  if (c.estado.presion >= DESPIDO.PRESION) return { carrera: terminarCarrera(c, 'despedido'), deltas: r.deltas };

  c.tramo++;
  if (c.tramo >= LIGA.TRAMOS.length) cerrarTemporada(c);
  else c.fase = FASES.TRAMO;
  return { carrera: c, deltas: r.deltas };
  // Asegurarnos de que el reemplazo es un forward joven si es posible
  const reemplazoData = getJugadorPorId(reemplazoId);

  if (reemplazoData && remplazoData.posicion === 'DEL' && reemplazoData.temporadaActual < 3) {
    // Penalización adicional para forwards juveniles
    c.ratingDelta -= 5;
    c.fatiga += 15;
    console.log(`Penalización extra para forward ${reemplazoData.nombre} (temporada: ${reemplazoData.temporadaActual})`);
  }


}

/**
 * Elige el reemplazo para un lesionado (fase LESION).
 * reemplazoId: id de la carta del banco que entra al 11.
 * Si no hay suplente (reemplazoId null/undefined o no válido), aplica ratingDelta -= 2.
 */
export function elegirReemplazoLesion(c, reemplazoId) {
  const lesionadoId = c.lesionadoId;
  if (!lesionadoId) {
    c.fase = FASES.TRAMO;
    return { carrera: c, deltas: {} };
  }

  const porId = new Map(c.plantel.map((x) => [x.id, x]));
  const lesionado = porId.get(lesionadoId);
  const onceSet = new Set(c.once);

  // Buscar suplentes válidos (plantel - titulares)
  const suplentes = c.plantel.filter((j) => !onceSet.has(j.id));

  let deltas = {};
  if (reemplazoId && suplentes.some((s) => s.id === reemplazoId)) {
    // Hacer el swap en el 11
    const idx = c.once.indexOf(lesionadoId);
    if (idx >= 0) {
      c.once[idx] = reemplazoId;
    }
  } else {
    // No hay suplente disponible o no se eligió uno válido: penalidad automática
    const r = aplicarEfectos(c.estado, { ratingDelta: -2 }, 'lesion-sin-suplente', c.historial);
    c.estado = r.estado;
    deltas = r.deltas;
  }

  c.lesionadoId = null;
  c.fase = FASES.TRAMO;
  return { carrera: c, deltas };
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
    tablaTop5: tabla.slice(0, 5).map((t) => ({ nombre: t.nombre, pts: t.pts, clubId: c.liga.equipos[t.id]?.clubId ?? null, esMio: t.id === 0 })),
    estadisticas: { goleadores: { ...c.estadisticas.goleadores }, asistencias: { ...c.estadisticas.asistencias } },
  });

  c.ultimaTemporada = c.temporadas[c.temporadas.length - 1];

  if (c.estado.presion >= DESPIDO.PRESION) { terminarCarrera(c, 'despedido'); return c; }
  if (c.temporada >= CARRERA.TEMPORADAS) { terminarCarrera(c, 'contrato-cumplido'); return c; }

  c.fase = FASES.RESUMEN;
  return c;
}

// Un jugador es el MISMO si comparte fut_id (id de FUT — ya sea el eaId de la
// carta o el basePlayerEaId cuando existe). Sin fut_id, cae al nombre normalizado
// como respaldo. Se usa para no repetir jugadores dentro del sobre ni ofrecer
// alguien que ya está en el plantel.
function claveJugador(c) {
  return c.fut_id ? `fid:${c.fut_id}` : `nom:${(c.nombre || '').toLowerCase().trim()}`;
}

function dedupeYExcluir(cartas, plantel) {
  const yaEnPlantel = new Set((plantel || []).map(claveJugador));
  const vistos = new Set();
  return cartas.filter((c) => {
    const k = claveJugador(c);
    if (yaEnPlantel.has(k) || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/** Bisagra entre loop corto y loop largo: el sobre de refuerzo. */
export function abrirRefuerzo(c, pool = null) {
  const futIdsPlantel = (c.plantel || []).map((x) => x.fut_id).filter(Boolean);
  const cartas = cargarCartasDB(sobreRefuerzo(c.rng, c.ultimaTemporada.posicion, futIdsPlantel, pool));
  c.refuerzo = dedupeYExcluir(cartas, c.plantel);
  c.fase = FASES.REFUERZO;
  return c.refuerzo;
}

/**
 * cartasCrudasDB es el array que te devolvió supabase.rpc('open_pack')
 */
export function registrarRefuerzo(c, cartasCrudasDB) {
  // Mismo formateo que abrirRefuerzo: el motor SIEMPRE guarda cartas con
  // shape {id, nombre, pos, rating, edad, rareza}, nunca columnas DB crudas.
  c.refuerzo = dedupeYExcluir(cargarCartasDB(cartasCrudasDB), c.plantel);
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
  
  const { plantel: nuevos, retirados } = envejecerPlantel(c.rng, c.plantel);
  c.plantel = nuevos;
  c.retirados = (c.retirados || []).concat(retirados);
  c.temporada++;
  c.tramo = 0;
  
  const pos = c.ultimaTemporada ? c.ultimaTemporada.posicion : 10;
  const apriete = pos <= 5 ? 1 : TEMPORADA.OBJETIVO_APRIETE;
  c.objetivo = Math.max(TEMPORADA.OBJETIVO_PISO, Math.min(14, pos - apriete));
  
  c.partidosTemporada = [];
  c.momentum = 0;
  c.refuerzo = null;
  c.estadisticas = { goleadores: {}, asistencias: {} };
  const ovrDT = c.plantel.length
    ? Math.round(c.plantel.reduce((s, j) => s + j.rating, 0) / c.plantel.length)
    : null;
  c.liga = crearLiga(c.rng, { id: c.clubId || null, name: c.club, leagueId: c.leagueId || null }, { temporada: c.temporada, posAnterior: pos, ovrDT });
  c.once = autoOnce(c.plantel, { formacion: fSlots(c.formacion) });
  c.fase = FASES.ONCE;
  
  return c;
}

/** Calcula qué jugadores del plantel reciben oferta del exterior. Llama antes de abrir el sobre. */
export function calcularOfertasPlantel(c) {
  const { PROB_OFERTA_JUGADOR_GRANDE, PROB_OFERTA_JUGADOR_MEDIO, MAX_SALIDAS_POR_TEMPORADA, MONEY_VENTA_BASE, MONEY_VENTA_POR_OVR } = ROTACION_PLANTEL;
  const conOferta = c.plantel
    .filter(j => {
        if (c.once.includes(j.id)) return false;
      const esGrande = j.rating >= 82 && j.edad >= 28;
      const esMedio  = j.rating >= 74 && j.rating < 82;
      const prob = esGrande ? PROB_OFERTA_JUGADOR_GRANDE : esMedio ? PROB_OFERTA_JUGADOR_MEDIO : 0;
      return c.rng.next() < prob;
    })
    .slice(0, MAX_SALIDAS_POR_TEMPORADA)
    .map(j => ({ ...j, moneyOferta: Math.round(MONEY_VENTA_BASE + MONEY_VENTA_POR_OVR * Math.max(0, j.rating - 74)) }));
  c.jugadoresConOferta = conOferta.length ? conOferta : null;
  c.sobreExtraRotacion = 0;
}

/** Resuelve una oferta de venta o rechazo para un jugador con oferta del exterior. */
export function resolverOferta(c, id, vender) {
  const j = (c.jugadoresConOferta || []).find(x => x.id === id);
  if (!j) return;
  c.jugadoresConOferta = c.jugadoresConOferta.filter(x => x.id !== id);
  if (vender) {
    c.plantel = c.plantel.filter(x => x.id !== id);
    const r = aplicarEfectos(c.estado, { money: j.moneyOferta }, 'venta-rotacion', c.historial);
    c.estado = r.estado;
    c.sobreExtraRotacion = (c.sobreExtraRotacion || 0) + 1;
  } else {
    const r = aplicarEfectos(c.estado, { moral: 5 }, 'rechazo-oferta', c.historial);
    c.estado = r.estado;
  }
}

/** Genera N cartas extra de refuerzo para compensar ventas de rotación. */
export function cartasExtraRefuerzo(c, n, pool = null) {
  const pos = c.ultimaTemporada?.posicion ?? 10;
  const extra = [];
  for (let i = 0; i < n; i++) extra.push(...cargarCartasDB(sobreRefuerzo(c.rng, pos, [], pool)));
  return extra;
}

function terminarCarrera(c, motivo) {
  c.fase = FASES.FIN;
  c.motivoFin = motivo;
  return c;
}

/**
 * Modo difícil: reemplaza la presión del evento por los valores asimétricos fijos.
 * +25 si el efecto era positivo (mala decisión), -10 si era negativo (alivio).
 * Si el evento no tenía presión, se deduce del net de moral y ratingDelta.
 */
function escalarPresionDificil(efectos) {
  const e = { ...efectos };
  if (typeof e.presion === 'number' && e.presion !== 0) {
    e.presion = e.presion > 0 ? PRESION_DIFICIL.SUBE : PRESION_DIFICIL.BAJA;
  } else {
    // Sin presión explícita: inferir por calidad neta del outcome
    const net = (e.moral ?? 0) + (e.ratingDelta ?? 0) * 2 - (e.fatiga ?? 0) * 0.5;
    e.presion = net > 0 ? PRESION_DIFICIL.BAJA : PRESION_DIFICIL.SUBE;
  }
  return e;
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
