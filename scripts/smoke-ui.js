// Smoke test de la UI: juega una carrera completa con los mismos clicks del jugador.
// Los clubes salen de leagues.js (local); las cartas del draft inicial salen del
// REST stubeado (/rest/v1/cards + /rest/v1/user_cards) con el shape real de `cards`,
// así el harness ejercita openInitialPacks (draft real de 25 cartas) sin tocar la BD.
// La edge open-pack queda solo para el sobre de refuerzo y devuelve null → catálogo local.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
dom.window.scrollTo = () => {};
// jsdom expone el constructor Image pero Node no lo exporta al global: sin esto
// el preload de escudos/cartas (new Image()) en ob-liga rompe el harness.
global.Image = dom.window.Image ?? global.Image;

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

// Pool de cartas del stub: replicamos el shape de la tabla `cards` que pide
// openInitialPacks (id, name, club, position, overall_rating, rarity, photo_url,
// ..., league_id). 40 cartas de LaLiga repartidas por posición: cubre los mínimos
// de draftSquad (2 POR, 6 DEF, 6 MED, 4 DEL) y el total de 25 del plantel.
const CARTAS_STUB = Array.from({ length: 40 }, (_, i) => {
  const position = ['POR', 'DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'DEL', 'DEL'][i % 10];
  return {
    id: `stub-card-${i + 1}`,
    name: `Jugador ${i + 1}`,
    club: 'FC Barcelona',
    position,
    overall_rating: 60 + (i % 25), // cubre bronce…épica según ratingTiers
    rarity: i % 4 === 0 ? 'epica' : i % 3 === 0 ? 'oro_unico' : 'oro_comun',
    photo_url: 'https://cdn.example/photo.png',
    fut_id: String(1000 + i),
    uses_generated_avatar: false,
    club_badge_url: null,
    nation_flag_url: null,
    league_logo_url: null,
    league_id: 'laliga',
  };
});

// Captura los bodies de open-pack para asertar el contrato (manager_id, free)
// contra el id real que devolvió crearManager — sin depender de la BD real.
const bodiesOpenPack = [];

global.fetch = async (url, opts = {}) => {
  const u = String(url);
  const responder = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
  // GET /rest/v1/cards (fetchCardPool del draft) → pool de la liga pedida.
  if (u.includes('/rest/v1/cards')) return responder(CARTAS_STUB);
  // user_cards: GET (fetchOwnedCardIds) → inventario vacío; POST (upsert de las
  // 25 cartas del draft) → ok sin body.
  if (u.includes('/rest/v1/user_cards')) {
    return opts.method === 'POST' ? responder([], 201) : responder([]);
  }
  // POST /rest/v1/managers (crearManager) → PostgREST single: el body es un objeto.
  if (u.includes('/rest/v1/managers')) return responder({ id: 'smoke-manager' }, 201);
  // POST /functions/v1/open-pack → sin cartas: el motor usa el fallback local.
  // Se captura el body recibido para asertar el contrato más abajo.
  if (u.includes('/functions/v1/open-pack')) {
    const body = typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body;
    bodiesOpenPack.push(body);
    return responder({ cards: null });
  }
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

// — Crear DT: onboarding → nombre → país (dropdown visual) → liga → club.
const dtInput = document.getElementById('ob-dt');
dtInput.value = 'Bilardo';
dtInput.dispatchEvent(new dom.window.Event('input', { bubbles: true })); // actualiza ui.onboarding.nombre
await click('ob-pais'); // abre el dropdown de país
await click('ob-pais', '[data-pais="Argentina"]');
await click('ob-liga', '[data-liga="laliga"]');
await new Promise((r) => setTimeout(r, 50)); // espera el import de leagues.js
if ($('#ob-club').disabled) throw new Error('No cargaron los clubes en onboarding');
await click('ob-club'); // abre el dropdown de clubes
await click('ob-club', '[data-id="barcelona"]'); // slug de leagues.js (FC Barcelona)
await click('ob-confirmar');
await new Promise((r) => setTimeout(r, 100)); // espera crearManager + draft REST

// Contrato del draft inicial: openInitialPacks entrega 5 sobres × 5 cartas de la
// liga elegida (25 en la grilla al abrir todos). El onboarding NO debe tocar la
// edge open-pack.
if (localStorage.getItem('manager_id') !== 'smoke-manager') {
  throw new Error('main.js no persistió manager_id en localStorage. Pantalla:\n' + document.body.textContent.slice(0, 400));
}
if (bodiesOpenPack.some((b) => b.free === true)) {
  throw new Error('El onboarding llamó open-pack con free:true — debería usar openInitialPacks');
}
const btnsSobres = document.querySelectorAll('[data-accion="abrir-sobre"]');
if (btnsSobres.length !== 5) {
  throw new Error(`Draft inicial: se esperaban 5 sobres, hay ${btnsSobres.length}`);
}
for (let i = 0; i < 5; i++) await click('abrir-sobre', `[data-i="${i}"]`);
await new Promise((r) => setTimeout(r, 10));
const cartasReveladas = document.querySelectorAll('.grid-cartas .carta-slot').length;
if (cartasReveladas !== 25) {
  throw new Error(`Draft inicial: se esperaban 25 cartas reveladas, hay ${cartasReveladas}`);
}
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

// Contrato open-pack en el refuerzo post-temporada: free: false y el mismo
// manager_id persistido en localStorage (misma fuente que main.js abrir-refuerzo).
// Ya no hay llamadas de bienvenida (esas las reemplazó openInitialPacks).
const refuerzos = bodiesOpenPack.filter((b) => b.free === false);
if (bodiesOpenPack.length < 1) throw new Error('Ningún sobre de refuerzo llamó a open-pack');
if (bodiesOpenPack.some((b) => b.free !== false)) {
  throw new Error('open-pack se llamó con free:true fuera del onboarding');
}
for (const b of refuerzos) {
  if (b.manager_id !== localStorage.getItem('manager_id')) {
    throw new Error(`Refuerzo mandó manager_id distinto al persistido: ${JSON.stringify(b)}`);
  }
}
console.log(`✔ Contrato draft/open-pack: ${cartasReveladas} cartas por openInitialPacks, ${bodiesOpenPack.length} open-pack SOLO en refuerzo (free=false, manager_id=${localStorage.getItem('manager_id')})`);

console.log(`✔ Carrera completa por UI: ${tramos} tramos, ${eventos} decisiones, ${temporadas} cierres de temporada`);
console.log('  Pantalla final:', document.querySelector('h1')?.textContent.trim());