// Proxy serverless (Vercel). La API key NUNCA sale al frontend.
// Antipatrón 2: si falta la env var, esto falla RUIDOSO (503 + mensaje explícito),
// no cae en silencio a otro modelo.
import { pedirGroq, groqConfigurada, GroqError } from './groq.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usá POST' });

  if (!groqConfigurada()) {
    return res.status(503).json({
      error: 'GROQ_API_KEY no está configurada. El juego sigue andando con el texto del catálogo, pero la narrativa de IA está apagada.',
    });
  }

  const { sistema, usuario } = req.body || {};
  if (typeof sistema !== 'string' || typeof usuario !== 'string') {
    return res.status(400).json({ error: 'Faltan "sistema" y/o "usuario" en el body.' });
  }

  try {
    const { contenido, modelo } = await pedirGroq({ sistema, usuario });
    return res.status(200).json({ contenido, modelo });
  } catch (e) {
    if (e instanceof GroqError) {
      return res.status(502).json({ error: e.message, detalle: e.detalle || undefined });
    }
    return res.status(502).json({ error: 'No se pudo contactar a GROQ', detalle: String(e.message) });
  }
}