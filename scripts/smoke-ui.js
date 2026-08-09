// Smoke test de la UI: juega una carrera completa a través de los mismos clicks del jugador.
// El arranque real pasa por onboarding (única vía create-DT: ligas, clubes y cartas de
// Supabase). Para no depender de credenciales ni mutar la BD real, el harness le da al
// cliente Supabase un env de juguete y un fetch stub que responde los endpoints que usa
// el alta del DT; open-pack devuelve null así el motor juega con el fallback local.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
dom.window.scrollTo = () => {};

// localStorage no existe en Node (el juego lo usa para guardar manager_id).
const STORE = new Map();
global.localStorage = {
  getItem: (k) => STORE.get(k) ?? null,
  setItem: (k, v) => STORE.set(k, String(v)),
  removeItem: (k) => STORE.delete(k),
};

// En Node no existe import.meta.env (Vite lo inyecta): el cliente cae a process.env.
// Con estas credenciales falsas supabase-js se inicializa y el fetch stub le responde.
process.env.VITE_SUPABASE_URL = 'https://stub.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'stub-anon-key';

const CLUBES_STUB = [
  { id: 'b1000000-0000-0000-0000-000000000001', league: 'laliga', name: 'Barcelona' },
  { id: 'b1000000-0000-0000-0000-000000000002', league: 'laliga', name: 'Atlético de Madrid' },
  { id: 'a1000000-0000-0000-0000-000000000001', league: 'premier', name: 'Arsenal' },
];

global.fetch = async (url, opts = {}) => {
  const u = String(url);
  const responder = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
  // GET /rest/v1/clubs?league=eq.…
  if (u.includes('/rest/v1/clubs')) {
    const liga = (new URL(u).searchParams.get('league') || '').replace(/^eq\./, '');
    return responder(CLUBES_STUB.filter((c) => c.league === liga));
  }
  // POST /rest/v1/managers (crearManager) → PostgREST single: el body es un objeto.
  if (u.includes('/rest/v1/managers')) return responder({ id: 'smoke-manager' }, 201);
  // POST /functions/v1/open-pack → sin cartas: el motor usa el fallback local.
  if (u.includes('/functions/v1/open-pack')) return responder({ cards: null });
  // Todo lo demás (p.ej. /api/evento) falla: narración usa el catálogo local.
  throw new Error(`sin stub en smoke test: ${u}`);
};

await import('../src/ui/main.js');

const $ = (sel) => document.querySelector(sel);
const click = async (accion, extra = '') => {
  const el = document.querySelector(`[data-accion="${accion}"]${extra}`);
  if (!el) throw new Error(`No existe el botón "${accion}" en la pantalla actual`);
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 0));
};

// — Crear DT: onboarding → país (dropdown) → liga → clubes reales (stub) → club (dropdown).
document.getElementById('ob-dt').value = 'DT Smoke';
await click('ob-pais'); // abre el dropdown de países
await click('ob-pais', '[data-pais="Argentina"]');
await click('ob-liga', '[data-liga="laliga"]');
await new Promise((r) => setTimeout(r, 50)); // espera el fetch de clubes
if ($('#ob-club').disabled) throw new Error('No cargaron los clubes en onboarding');
await click('ob-club'); // abre el dropdown de clubes
await click('ob-club', '[data-id="b1000000-0000-0000-0000-000000000001"]');
await click('ob-confirmar');
await new Promise((r) => setTimeout(r, 50)); // espera crearManager + sobres
for (let i = 0; i < 3; i++) await click('abrir-sobre', `[data-i="${i}"]`);
await new Promise((r) => setTimeout(r, 50)); // espera el open-pack local
await click('ir-once');
await click('auto-once');
await click('confirmar-once');

let pasos = 0, tramos = 0, eventos = 0, temporadas = 0;
while (!document.querySelector('[data-accion="reiniciar"]') && pasos++ < 400) {
  if ($('[data-accion="jugar"]')) { await click('jugar'); tramos++; continue; }
  if ($('[data-accion="ir-evento"]')) { await click('ir-evento'); continue; }
  if ($('[data-accion="elegir"]')) { await click('elegir'); eventos++; continue; }
  if ($('[data-accion="abrir-refuerzo"]')) { await click('abrir-refuerzo'); temporadas++; continue; }
  if ($('[data-accion="confirmar-refuerzo"]')) {
    document.querySelectorAll('[data-accion="sel-refuerzo"]')[0]
      ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    const btn = $('[data-accion="confirmar-refuerzo"]');
    if (btn.disabled) {
      document.querySelectorAll('[data-accion="sel-venta"]')[0]
        ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
    }
    await click('confirmar-refuerzo'); continue;
  }
  if ($('[data-accion="confirmar-once"]')) { await click('confirmar-once'); continue; }
  throw new Error('Pantalla sin salida:\n' + document.body.textContent.slice(0, 300));
}
if (pasos >= 400) throw new Error('La UI se quedó en loop');
console.log(`✔ Carrera completa por UI: ${tramos} tramos, ${eventos} decisiones, ${temporadas} cierres de temporada`);
console.log('  Pantalla final:', document.querySelector('h1')?.textContent.trim());
