// generar-evento.js — función serverless de Vercel que le pide a Groq que
// elija, entre varios paquetes de evento candidatos, cuál tiene más sentido
// narrativo dado el careerStateSnapshot, y que redacte su título/narración
// y las labels de sus opciones.
//
// Es puramente cosmético: si Groq tarda, falla, o devuelve algo que no pasa
// la validación estricta, la función cae al fallback (elección al azar entre
// los candidatos + textos fallback del catálogo) y responde 200 igual. El
// juego nunca debe bloquearse ni mostrar un error por culpa de la IA.

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const TIMEOUT_MS = 2500;

const TITULO_MAX = 70;
const NARRACION_MAX = 450;
const LABEL_MAX = 90;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { careerStateSnapshot, candidatos } = req.body || {};

  if (!careerStateSnapshot || !Array.isArray(candidatos) || candidatos.length === 0) {
    res.status(400).json({ error: 'Falta careerStateSnapshot o candidatos (array no vacío)' });
    return;
  }

  try {
    const resultado = await generarConGroq(careerStateSnapshot, candidatos);
    const error = validarResultado(resultado, candidatos);
    if (!error) {
      console.log('generar-evento: usando resultado de IA');
      res.status(200).json(resultado);
      return;
    }
    console.log('generar-evento: respuesta de IA inválida, usando fallback:', error);
  } catch (error) {
    // No logueamos el error completo: podría traer el body de la request de
    // Groq, que incluye la API key en la URL. Solo el mensaje.
    console.log('generar-evento: fallo al generar con Groq, usando fallback:', error.message);
  }

  res.status(200).json(construirFallback(candidatos));
}

function validarResultado(resultado, candidatos) {
  if (!resultado || typeof resultado !== 'object') return 'resultado no es un objeto';

  const { paqueteId, titulo, narracion, labels } = resultado;

  const paquete = candidatos.find((c) => c.paqueteId === paqueteId);
  if (!paquete) return 'paqueteId no está entre los candidatos';

  if (typeof titulo !== 'string' || titulo.trim().length === 0 || titulo.length > TITULO_MAX) {
    return 'titulo inválido';
  }

  if (typeof narracion !== 'string' || narracion.trim().length === 0 || narracion.length > NARRACION_MAX) {
    return 'narracion inválida';
  }

  if (!Array.isArray(labels)) return 'labels no es un array';

  const optionIdsEsperados = new Set((paquete.options || []).map((o) => o.optionId));
  const optionIdsRecibidos = new Set(labels.map((l) => l?.optionId));

  if (optionIdsEsperados.size !== labels.length) return 'labels tiene tamaño distinto a options';
  if (optionIdsEsperados.size !== optionIdsRecibidos.size) return 'labels tiene optionId duplicados';
  for (const id of optionIdsEsperados) {
    if (!optionIdsRecibidos.has(id)) return 'labels no cubre todos los optionId del paquete';
  }

  for (const label of labels) {
    if (typeof label?.label !== 'string' || label.label.trim().length === 0 || label.label.length > LABEL_MAX) {
      return 'label individual inválida';
    }
  }

  return null;
}

function construirFallback(candidatos) {
  const paquete = candidatos[Math.floor(Math.random() * candidatos.length)];

  return {
    paqueteId: paquete.paqueteId,
    titulo: paquete.tituloFallback,
    narracion: paquete.descripcionFallback,
    labels: (paquete.options || []).map((option) => ({
      optionId: option.optionId,
      label: option.labelFallback,
    })),
  };
}

async function generarConGroq(careerStateSnapshot, candidatos) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY no configurada');

  const prompt = construirPrompt(careerStateSnapshot, candidatos);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const fetchPromise = fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal: controller.signal,
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const timeoutPromise = new Promise((_, reject) => {
    // El AbortController ya cancela el fetch al vencer el timeout; este
    // rechazo asegura que no esperemos más de TIMEOUT_MS aunque el fetch
    // tarde en propagar el abort.
    setTimeout(() => reject(new Error('Timeout esperando a Groq')), TIMEOUT_MS);
  });

  let response;
  try {
    response = await Promise.race([fetchPromise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Groq respondió con status ${response.status}`);
  }

  const data = await response.json();
  const texto = data?.choices?.[0]?.message?.content;
  if (typeof texto !== 'string') throw new Error('Respuesta de Groq sin texto');

  return JSON.parse(extraerJson(texto));
}

function extraerJson(texto) {
  const match = texto.match(/\{[\s\S]*\}/);
  return match ? match[0] : texto;
}

const SYSTEM_PROMPT = `Sos el narrador de un simulador de manager de fútbol. Vas a recibir el estado actual de la carrera del manager y una lista de paquetes de evento candidatos. Tu trabajo:

1. Elegir el paqueteId que más sentido narrativo tenga dado el estado actual de la carrera.
2. Redactar un "titulo" y una "narracion" para ese paquete, en el tono que sugiere su tradeOffProsa.
3. Generar un label corto para cada option del paquete elegido, usando su resumenEfectos como guía de tono — sin inventar números ni valores concretos, solo tono.

Respondé SOLO con un JSON válido, sin texto extra ni markdown, con esta forma exacta:
{"paqueteId": "...", "titulo": "...", "narracion": "...", "labels": [{"optionId": "...", "label": "..."}]}

El array "labels" debe tener exactamente un elemento por cada option del paquete elegido, ni más ni menos.`;

function construirPrompt(careerStateSnapshot, candidatos) {
  return `Estado actual de la carrera:
${JSON.stringify(careerStateSnapshot)}

Paquetes de evento candidatos:
${JSON.stringify(candidatos)}`;
}
