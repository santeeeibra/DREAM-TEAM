// IMPURO (fetch). El motor no importa este archivo: es la UI la que lo llama.
import { construirPrompt, validarNarracion } from '../engine/narrador.js';

export const TIMEOUT_MS = 3500; // si GROQ tarda más, se juega con el texto del catálogo

/** Devuelve una narración validada, o null. null ⇒ el llamador usa el sorteo local. */
export async function pedirNarracion(candidatos, ctx) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const { sistema, usuario } = construirPrompt(candidatos, ctx);
    const r = await fetch('/api/evento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sistema, usuario }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      // Antipatrón 2: la config rota se grita en consola, nunca se traga en silencio.
      const detalle = await r.text().catch(() => '');
      console.warn(`[dream-team] /api/evento respondió ${r.status}. ${detalle}`);
      return null;
    }
    const { contenido } = await r.json();
    const narracion = validarNarracion(contenido, candidatos, ctx);
    if (!narracion) console.warn('[dream-team] respuesta de IA inválida, se usa el catálogo.');
    return narracion;
  } catch (e) {
    if (e.name !== 'AbortError') console.warn('[dream-team] fallo al pedir narración:', e.message);
    return null;
  } finally {
    clearTimeout(t);
  }
}
