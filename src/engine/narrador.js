// PURA. Arma el prompt y valida la respuesta. NO hace fetch (eso vive en src/net/).
// Así el harness headless puede testear la validación sin llamar a ningún modelo.

export const LIMITES = { titulo: 60, texto: 320, label: 42 };

/**
 * Traduce los efectos numéricos crudos a directivas narrativas conceptuales.
 * Así evitamos que la IA vea { fatiga: 12 } y diga "necesita calentamiento".
 */
function pistasDeEfectos(efectos) {
  if (!efectos) return "Efecto neutro";

  const pistas = [];
  if (efectos.moral > 0) pistas.push("Sube la moral del equipo/jugador");
  if (efectos.moral < 0) pistas.push("Baja la moral o genera conflicto");
  if (efectos.fatiga > 0) pistas.push("Aumenta el desgaste o riesgo físico");
  if (efectos.fatiga < 0) pistas.push("Da descanso y recuperación física");
  if (efectos.money > 0) pistas.push("Ingresa dinero al club");
  if (efectos.money < 0) pistas.push("El club gasta dinero o paga multas");
  if (efectos.presion > 0) pistas.push("Aumenta la presión de la prensa/hinchas/directiva");
  if (efectos.presion < 0) pistas.push("Descomprime la presión del entorno");
  if (efectos.ratingDelta > 0) pistas.push("El equipo rinde mejor en los próximos partidos");
  if (efectos.ratingDelta < 0) pistas.push("El equipo rinde peor en los próximos partidos");

  return pistas.length > 0 ? pistas.join(', ') : "Efecto neutro";
}

/**
 * Una opción puede tener un efecto fijo, o una lista de ramas con probabilidad
 * (50/50, 60/40, 70/30…) que recién se sortea al resolver la elección. Acá NO
 * se revela el número exacto de probabilidad a la IA: sólo qué desenlace es
 * el más probable y cuál el riesgo, para que lo transmita como incertidumbre
 * narrativa genuina, no como una estadística.
 */
function traducirEfectosParaIA(opcion) {
  if (!opcion.resultado) return pistasDeEfectos(opcion.efectos);

  const ramas = [...opcion.resultado].sort((a, b) => b.prob - a.prob);
  return ramas
    .map((r, i) => {
      const peso = i === 0 ? 'Lo más probable' : 'Pero hay riesgo real de que en cambio';
      const nota = r.nota ? ` (${r.nota})` : '';
      return `${peso}: ${pistasDeEfectos(r.efectos)}${nota}`;
    })
    .join('. ');
}

/** El modelo recibe el trade-off narrativo y ELIGE cuál narrar. */
export function construirPrompt(candidatos, ctx) {
  // En lugar de pasar los números duros (que fomentan la literalidad), 
  // le pasamos a la IA qué debe "justificar" en su relato.
  const resumen = candidatos.map((c) => ({
    id: c.id,
    tags: c.tags,
    opciones: c.opciones.map((o) => ({
      id: o.id,
      consecuencia_a_justificar: traducirEfectosParaIA(o),
    })),
  }));

  const sistema = [
    'Sos el guionista principal de un videojuego de gestión de fútbol argentino (estilo Football Manager).',
    'Recibís opciones de eventos. Tu trabajo es elegir UNO y narrar un dilema dramático, realista e inmersivo para el Director Técnico.',
    'INSPIRACIÓN: Basate en escándalos o situaciones de la vida real del fútbol (jugador de fiesta antes de un partido clave, peleas internas de plantel, doping, ofertas de venta, sponsors incómodos, presión de la hinchada, tácticas expuestas, lesiones ocultadas, rumores de amaño). Cuanto más concreta y menos genérica la situación, mejor.',
    'REGLA DE ORO: NUNCA menciones estadísticas, números, porcentajes, "moral", "fatiga", "plata" ni uses términos de videojuego de forma literal. Inventá la situación futbolera que justifica las consecuencias dadas.',
    'CONSECUENCIAS CONCRETAS: las pistas que te paso ya te dicen qué va a pasar en el campo, en el humor del plantel o en la economía del club. Anclá el relato a algo específico y palpable (el próximo rival, la racha, el vestuario, la caja del club) — nunca una moraleja abstracta.',
    'RIESGO GENUINO: algunas opciones tienen dos desenlaces posibles ("lo más probable" y "el riesgo"). Transmití esa incertidumbre en el propio dilema (que se sienta una apuesta real, sin garantías), pero JAMÁS menciones un porcentaje ni la palabra "probabilidad": contalo como riesgo futbolero, no como estadística.',
    'Solo usá el nombre real de la figura o próximo rival si el candidato elegido tiene el tag "individual" en su lista de tags. Si no lo tiene, hacé que el problema sea general (el plantel, la prensa, la dirigencia, sponsors).',
    'Respondés SOLO JSON válido, sin markdown, sin texto fuera del JSON.',
    'Formato: {"paqueteId":string,"titulo":string,"texto":string,"opciones":[{"id":string,"label":string}]}',
    `Límites: titulo ≤${LIMITES.titulo} caracteres, texto ≤${LIMITES.texto}, label ≤${LIMITES.label}.`,
    'El paqueteId debe ser uno de los candidatos. Las opciones deben ser exactamente las del paquete elegido, con sus mismos ids.',
    'Las labels de las opciones son las decisiones que toma el DT (ej: "Sancionarlo económicamente y apartarlo"). Deben justificar las consecuencias pedidas.',
    'Tono: rioplatense, inmersivo, jerga futbolera seria y dramática. Nada de épica exagerada de relator.',
  ].join(' ');

  const usuario = JSON.stringify({
    contexto: {
      dt: ctx.dt, club: ctx.club, temporada: ctx.temporada, tramo: ctx.tramo + 1,
      posicion: ctx.posicion, racha: ctx.racha,
      // Se omite mandar los stats crudos del equipo al prompt para forzar foco narrativo
      figura: ctx.figura ? { nombre: ctx.figura.nombre, pos: ctx.figura.pos } : null,
      proximoRival: ctx.rival ? { nombre: ctx.rival.nombre, localia: ctx.rival.localia } : null,
    },
    candidatos_para_elegir: resumen,
  });

  return { sistema, usuario };
}

/**
 * La IA a veces nombra a la figura/rival igual en eventos genéricos, aunque el
 * system prompt se lo prohíba (línea ~68): un prompt es una sugerencia, no una
 * garantía. Esto es el guardrail real — si el paquete elegido NO tiene el tag
 * "individual", el nombre propio no puede aparecer en el texto generado.
 */
function nombrePropioFiltrado(paquete, texto, ctx) {
  if (paquete.tags?.includes('individual')) return false;
  const nombres = [ctx?.figura?.nombre, ctx?.rival?.nombre].filter(Boolean);
  return nombres.some((n) => texto.toLowerCase().includes(n.toLowerCase()));
}

/**
 * Validación estricta (§3.6). Devuelve la narración normalizada o null.
 * null ⇒ el llamador cae al sorteo ponderado + texto de respaldo, sin avisarle al jugador.
 */
export function validarNarracion(respuesta, candidatos, ctx) {
  try {
    const data = typeof respuesta === 'string' ? JSON.parse(limpiar(respuesta)) : respuesta;
    if (!data || typeof data !== 'object') return null;

    const paquete = candidatos.find((c) => c.id === data.paqueteId);
    if (!paquete) return null; // eligió algo fuera de los candidatos ofrecidos

    if (!esTexto(data.titulo, LIMITES.titulo)) return null;
    if (!esTexto(data.texto, LIMITES.texto)) return null;
    if (!Array.isArray(data.opciones) || data.opciones.length !== paquete.opciones.length) return null;

    const opciones = [];
    for (const o of paquete.opciones) {
      const dada = data.opciones.find((x) => x && x.id === o.id);
      if (!dada || !esTexto(dada.label, LIMITES.label)) return null;
      opciones.push({ id: o.id, label: dada.label.trim() });
    }

    const textoCompleto = [data.titulo, data.texto, ...opciones.map((o) => o.label)].join(' ');
    if (nombrePropioFiltrado(paquete, textoCompleto, ctx)) return null;

    return {
      paqueteId: paquete.id,
      titulo: data.titulo.trim(),
      texto: data.texto.trim(),
      opciones,
      fuente: 'ia',
    };
  } catch {
    return null;
  }
}

function esTexto(v, max) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
}

function limpiar(s) {
  return s.replace(/```json|```/g, '').trim();
}