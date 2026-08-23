// narrar-evento.js — función serverless de Vercel que le pide a Groq una
// versión narrada y personalizada de la descripción de un evento del
// catálogo, usando el careerStateSnapshot (money/morale/fatiga/pressure/
// streak/ratingDelta) como contexto de tono.
//
// Es puramente cosmético: si Groq tarda, falla, o devuelve algo que no se
// puede parsear, la función cae al fallback (la descripción original del
// catálogo) y responde 200 igual. El juego nunca debe bloquearse ni mostrar
// un error por culpa de la narración con IA.

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const TIMEOUT_MS = 2500;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { eventDetails, careerStateSnapshot } = req.body || {};

  try {
    const narracion = await narrarConGroq(eventDetails, careerStateSnapshot);
    if (esNarracionValida(narracion)) {
      res.status(200).json({ narracion });
      return;
    }
  } catch (error) {
    // No logueamos el error completo: podría traer el body de la request de
    // Groq, que incluye la API key en la URL. Solo el mensaje.
    console.error('narrar-evento: fallo al narrar con Groq, usando fallback:', error.message);
  }

  res.status(200).json({ narracion: eventDetails?.descripcion });
}

function esNarracionValida(narracion) {
  return typeof narracion === 'string' && narracion.trim().length > 0;
}

async function narrarConGroq(eventDetails, careerStateSnapshot) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY no configurada');

  const prompt = construirPrompt(eventDetails, careerStateSnapshot);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Groq respondió con status ${response.status}`);
  }

  const data = await response.json();
  const texto = data?.choices?.[0]?.message?.content;
  if (typeof texto !== 'string') throw new Error('Respuesta de Groq sin texto');

  const parsed = JSON.parse(texto);
  return parsed.narracion;
}

function construirPrompt(eventDetails, careerStateSnapshot) {
  return `Sos el narrador de un simulador de manager de fútbol. Reescribí la descripción de un evento como una narración corta (2 a 4 frases), personalizada al momento actual de la carrera del manager.

Título del evento: ${eventDetails.titulo}
Descripción base del catálogo: ${eventDetails.descripcion}

Estado actual de la carrera (usalo para ajustar el tono, no lo menciones como datos crudos):
${JSON.stringify(careerStateSnapshot)}

Guía de tono:
- Si pressure > 70, el tono debe ser más tenso, con la sensación de que el club está sobre el manager.
- Si streak es alto (rachas ganadoras largas), el tono debe transmitir más confianza y control.
- Si streak es muy negativo o pressure es baja, ajustá el tono en consecuencia (más relajado, más incertidumbre, etc. según corresponda).

Respondé SOLO con un JSON, sin texto extra ni markdown, con esta forma exacta:
{"narracion": "..."}`;
}