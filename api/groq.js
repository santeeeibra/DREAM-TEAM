// Lógica compartida de la llamada a GROQ.
// La usan la función serverless de Vercel (api/evento.js) y el middleware
// de desarrollo de Vite (vite.config.js) para que el comportamiento sea
// idéntico en dev y en producción.
//
// Antipatrón 2: si falta la env var, la llamada falla RUIDOSO (503 + mensaje
// explícito) — cada uno de los dos callers lo maneja con su propio transporte.
// La API key NUNCA sale al frontend: sólo existe en el server.

export function groqConfigurada() {
  return Boolean(process.env.GROQ_API_KEY);
}

function modelo() {
  return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
}

/** Error cuando GROQ responde con status no-OK o contenido vacío. */
export class GroqError extends Error {
  constructor(message, detalle) {
    super(message);
    this.name = 'GroqError';
    this.detalle = detalle;
  }
}

/**
 * Llama a la API de GROQ con un prompt de sistema y usuario.
 * Devuelve { contenido, modelo } o lanza:
 *  - GroqError si GROQ respondió con error o contenido vacío.
 *  - Error genérico si hubo un fallo de red (fetch).
 */
export async function pedirGroq({ sistema, usuario }) {
  const key = process.env.GROQ_API_KEY;
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: modelo(),
      temperature: 0.9,
      max_tokens: 500,
      response_format: { type: 'json_object' }, // salida forzada a JSON
      messages: [
        { role: 'system', content: sistema },
        { role: 'user', content: usuario },
      ],
    }),
  });

  if (!r.ok) {
    const detalle = await r.text();
    throw new GroqError(`GROQ ${r.status}`, detalle.slice(0, 400));
  }

  const data = await r.json();
  const contenido = data?.choices?.[0]?.message?.content;
  if (!contenido) throw new GroqError('GROQ devolvió una respuesta vacía.');

  // Se devuelve crudo: la validación estricta vive en el motor (narrador.js).
  return { contenido, modelo: modelo() };
}