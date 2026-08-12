// PURA. §3 del plan. Este módulo es el ÚNICO camino para obtener un evento:
// no existe ningún otro lugar que sortee un paquete fijo (antipatrón 1 y 3).
import { CATALOGO, paquete, INTENSIDAD } from './catalogoEventos.js';

export const MIN_CANDIDATOS = 4;
export const MAX_CANDIDATOS = 6;

// Cupo de repetición por intensidad (§ rediseño v2): alta nunca repite en la
// carrera, media repite como máximo una vez por temporada, baja hasta 3 veces
// por temporada. `historial` es la lista { id, temporada } de eventos narrados.
export const BAJA_MAX_POR_TEMPORADA = 3;

// Ventana de rotación de figuras: un jugador no vuelve a ser el objetivo de un
// evento visible hasta que pasaron ROTACION_VENTANA eventos visibles por el medio.
export const ROTACION_VENTANA = 6;

/**
 * Últimos ids de figura nombrados en eventos VISIBLES (individuales y graves).
 * Es la memoria de rotación y vive en historialEventos (persistido en la DB),
 * así que tras un save/load es idéntica → los sorteos siguen siendo
 * deterministas con el rng de la carrera. Los eventos viejos (sin key `figura`)
 * se ignoran: retrocompatible.
 */
export function figurasRecientes(historial) {
  return historial
    .filter((h) => h.figura != null)
    .slice(-ROTACION_VENTANA)
    .map((h) => h.figura);
}

/**
 * Sortea una figura evitando las recientes (rotación entre decisiones) y la del
 * candidato anterior (adyacencia dentro del mismo lote). Gasta EXACTAMENTE un
 * draw de rng: cambia el tamaño del pool, nunca la cantidad de draws. Si las
 * exclusiones vacían el pool (plantel chico), cae al sorteo uniforme.
 */
export function figuraConRotacion(rng, plantel, recientes = [], evitarId = null) {
  if (!plantel.length) return null;
  const excluidos = new Set(recientes);
  if (evitarId != null) excluidos.add(evitarId);
  let pool = plantel.filter((x) => !excluidos.has(x.id));
  if (!pool.length) pool = plantel.filter((x) => x.id !== evitarId);
  if (!pool.length) pool = plantel;
  return pool[Math.floor(rng.next() * pool.length)];
}

function usadoAlgunaVez(historial, id) {
  return historial.some((h) => h.id === id);
}

function usosEnTemporada(historial, id, temporada) {
  return historial.filter((h) => h.id === id && h.temporada === temporada).length;
}

/** true si el evento todavía tiene cupo para volver a salir según su intensidad. */
function dentroDeCupo(e, historial, temporada) {
  if (e.intensidad === INTENSIDAD.ALTA) return !usadoAlgunaVez(historial, e.id);
  if (e.intensidad === INTENSIDAD.MEDIA) return usosEnTemporada(historial, e.id, temporada) === 0;
  return usosEnTemporada(historial, e.id, temporada) < BAJA_MAX_POR_TEMPORADA;
}

/**
 * ctx: { temporada, tramo, posicion, racha, ...estado }
 * historial: [{ id, temporada }] — eventos ya narrados en la carrera (§ candidatosDelTramo).
 */
export function candidatosEvento(rng, ctx, historial = []) {
  const nuncaAlta = (e) => e.intensidad !== INTENSIDAD.ALTA || !usadoAlgunaVez(historial, e.id);

  // Los eventos graves se manejan en un track separado (carrera.js candidatosDelTramo)
  let elegibles = CATALOGO.filter((e) => !e.grave && dentroDeCupo(e, historial, ctx.temporada) && e.filtro(ctx));

  // Si el contexto es tan estrecho que no llega al mínimo, se abre primero
  // relajando el cupo de intensidad (nunca el de "alta", que jamás repite),
  // y recién después se ignora también el filtro.
  if (elegibles.length < MIN_CANDIDATOS) {
    elegibles = elegibles.concat(CATALOGO.filter((e) => !elegibles.includes(e) && nuncaAlta(e) && e.filtro(ctx)));
  }
  if (elegibles.length < MIN_CANDIDATOS) {
    elegibles = elegibles.concat(CATALOGO.filter((e) => !elegibles.includes(e) && nuncaAlta(e)));
  }

  const n = Math.min(MAX_CANDIDATOS, Math.max(MIN_CANDIDATOS, 5), elegibles.length);
  const out = [];
  const pool = elegibles.slice();
  let lastFiguraId = null;
  while (out.length < n && pool.length) {
    const elegido = rng.weighted(pool);
    // Cada candidato lleva su propia figura: sorteo uniforme del plantel completo,
    // sin repetir la del candidato anterior. Se clona con spread para no mutar el
    // catálogo compartido (los candidatos siguen siendo objetos del CATALOGO + figura).
    const figura = figuraParaCandidato(rng, elegido, ctx, lastFiguraId);
    out.push({ ...elegido, figura });
    lastFiguraId = figura?.id ?? null;
    pool.splice(pool.indexOf(elegido), 1);
  }
  return out;
}

/**
 * Figura de un candidato: sorteo con rotación sobre el PLANTEL COMPLETO
 * (no solo el once). Evita las figuras recientes (figurasRecientes → la memoria
 * visible individual/grave de la carrera) y no repite la del candidato anterior
 * del lote (lastFiguraId). Los eventos con tag 'dt' (historias del DT) no
 * llevan figura: devuelve null.
 */
function figuraParaCandidato(rng, e, ctx, lastFiguraId) {
  if (e.tags?.includes('dt')) return null;
  return figuraConRotacion(rng, ctx.plantel || [], ctx.figurasRecientes || [], lastFiguraId);
}

/** Fallback silencioso hacia el jugador: sorteo ponderado + texto fijo del catálogo. */
export function elegirPorSorteo(rng, candidatos, ctx = {}) {
  const p = rng.weighted(candidatos);
  return narracionDeRespaldo(p, ctx);
}

function narracionDeRespaldo(candidato, ctx = {}) {
  const p = paquete(candidato.id);
  // La figura del candidato elegido manda. Si el candidato no trae figura (tag 'dt'
  // o plantel vacío), cae a la del contexto — comportamiento histórico de los graves.
  const ctxFigura = { ...ctx, figura: candidato.figura || ctx.figura };
  return {
    paqueteId: p.id,
    titulo: interpolar(p.titulo, ctxFigura),
    texto: interpolar(p.texto, ctxFigura),
    opciones: p.opciones.map((o) => ({ id: o.id, label: interpolar(o.label, ctxFigura) })),
    fuente: 'catalogo',
  };
}

/** Sustituye {figura}, {rival} en el texto de respaldo. Si el dato no está, cae a un genérico. */
function interpolar(texto, ctx) {
  return texto
    .replace(/\{figura\}/g, ctx.figura?.nombre || 'tu figura')
    .replace(/\{rival\}/g, ctx.rival?.nombre || 'el rival');
}

/**
 * Resuelve la opción elegida a un efecto concreto: si la opción tiene `efectos`
 * fijos, los devuelve tal cual; si tiene `resultado` (ramas 50/50, 60/40, 70/30…),
 * sortea UNA rama acá, con el rng de la carrera, y devuelve sus efectos.
 * Es el único lugar donde se decide qué rama probabilística tocó — nunca la IA.
 */
export function efectosDeOpcion(rng, paqueteId, opcionId) {
  const p = paquete(paqueteId);
  const o = p.opciones.find((x) => x.id === opcionId);
  if (!o) throw new Error(`Opción "${opcionId}" inexistente en el paquete "${paqueteId}"`);
  if (o.resultado) {
    const rama = sortearRama(rng, o.resultado, paqueteId, opcionId);
    return { efectos: rama.efectos, tramo: rama.tramo || o.tramo || null, rama: rama.nota || null };
  }
  return { efectos: o.efectos, tramo: o.tramo || null, rama: null };
}

function sortearRama(rng, ramas, paqueteId, opcionId) {
  const r = rng.next();
  let acc = 0;
  for (const rama of ramas) {
    acc += rama.prob;
    if (r < acc) return rama;
  }
  const suma = ramas.reduce((s, x) => s + x.prob, 0);
  if (Math.abs(suma - 1) > 0.001) {
    throw new Error(`Probabilidades de "${paqueteId}.${opcionId}" no suman 1 (suman ${suma})`);
  }
  return ramas[ramas.length - 1];
}
