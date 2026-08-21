// CAPA VISUAL. Sólo lee el motor y llama a sus funciones: no calcula reglas ni efectos.
import {
  iniciarCarrera, confirmarOnce, jugarTramo, candidatosDelTramo, fijarNarracion,
  resolverEvento, abrirRefuerzo, registrarRefuerzo, aplicarRefuerzo, resumenCarrera, ratingActual,
  elegirReemplazoLesion, calcularOfertasPlantel, resolverOferta, cartasExtraRefuerzo,
  contexto, FASES, autoOnce, FORMACION, FORMACIONES_SLOTS, ratingEnSlot, penalidad, slotsVacios, posiciones, miPosicion,
  paquete, valorDeVenta, CARRERA, LIGA, RANGOS, FUERZA,
} from '../engine/index.js';
import { CLUBES_JUGABLES } from '../data/nombres.js';
import { escudoDeNombre } from '../data/escudoteca.js';
import { pedirNarracion } from '../net/evento.js';
import { generateClubBadgeDataURI } from '../utils/badgeGenerator.js';

const app = document.getElementById('app');
// Único pack disponible por ahora (Sobre Dream Team): se usa tanto para los
// 3 sobres gratis del onboarding como para el sobre de refuerzo post-temporada.
const PACK_ID = 'b34f5178-ad24-47b8-a957-5c4c6c7e6587';
let c = null;
let ui = {
  vista: 'intro', vistaAnterior: 'intro', slot: null, sobresAbiertos: [], deltas: null, tabla: false,
  sel: new Set(), salen: new Set(), fuenteIA: null, cargando: false, detalleAbierto: new Set(), miEscudo: '',
  onboarding: { liga: null, clubes: [], clubId: '', nombre: '', pais: '', cargando: false, error: null, enviando: false, abierto: null, modo: 'facil', modoJuego: 'liga', formacion: '4-3-3' },
  draftPuro: null,
};
// Estado del drag & drop (desktop: HTML5 DnD, mobile: touch drag)
let dragState = { active: false, playerId: null, sourceType: null, sourceSlotIdx: null, ghost: null, startX: 0, startY: 0, moved: false };
// Hidratar draft de DT si existe
const _dtDraft = (() => { try { return JSON.parse(localStorage.getItem('dt_draft') || 'null'); } catch { return null; } })();
if (_dtDraft) ui.onboarding = { ...ui.onboarding, ..._dtDraft };
// La entrada animada del onboarding corre UNA vez por carga de página: cada
// acción (p. ej. abrir un dropdown) re-renderiza el DOM completo y no queremos
// que la pantalla "parpadee" en cada interacción.
let obPrimeraVezOnboarding = true;
// Las pantallas de temporada animan UNA vez por cambio de vista: el toggle de
// la tabla re-renderiza la misma vista y no debe volver a abrir la cortina.
let tsEntra = false;
let tsVistaAnterior = null;

// ───────────────────────── helpers de vista ─────────────────────────
const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const ICONO = { money: '💰', moral: '😊', fatiga: '🔋', presion: '🔥', ratingDelta: '⭐' };
const NOMBRE_VAR = { money: 'Plata', moral: 'Moral', fatiga: 'Fatiga', presion: 'Presión', ratingDelta: 'Nivel' };
// fatiga y presión: subir es malo. El resto: subir es bueno.
const MALO_SI_SUBE = new Set(['fatiga', 'presion']);
// Recordatorio corto de qué mueve cada variable en la cancha — se repite acá
// (además de en la guía) porque en el momento de decidir es cuando más falta hace.
const EXPLICACION_VAR = {
  moral: 'sube = rinde mejor',
  fatiga: 'sube = rinde peor',
  presion: 'llega a 100 y te echan',
  ratingDelta: 'fuerza extra este tramo',
  money: 'para fichar refuerzos',
};
const HINT_VAR = {
  moral: '↑ rinde mejor',
  fatiga: '↓ cansa menos',
  presion: '100 = te echan',
  ratingDelta: 'bono este tramo',
  money: 'para fichajes',
};

// Silueta de fallback cuando el jugador no tiene foto (mismo trazo que antes,
// ahora es el <img src> por defecto en vez de una rama de markup aparte).
const SIL_CARTA = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3f49"/><stop offset="1" stop-color="#20242b"/></linearGradient></defs><rect width="200" height="200" fill="#181b21"/><circle cx="100" cy="78" r="40" fill="url(#g)"/><path d="M30 200c0-42 32-66 70-66s70 24 70 66z" fill="url(#g)"/></svg>');

// ───────────────────────── simulación visual de partido ─────────────────────────
const ZONA_POR_POS = { POR: 0, DEF: 1, MED: 2, DEL: 3 };
const ZONA_LABELS = ['DEF', 'MED₁', 'MEDIO', 'MED₂', 'ATQ'];

function generarJugadas(partido, misJugadores) {
  const jugadas = [];
  const { gf, gc, rival, localia } = partido;
  const total = gf + gc;
  const numJugadas = Math.min(8, Math.max(5, total * 2 + 2));
  let golesMios = 0, golesRival = 0;
  const delanteros = misJugadores.filter((j) => j.pos === 'DEL');
  const medios = misJugadores.filter((j) => j.pos === 'MED');
  const defensas = misJugadores.filter((j) => j.pos === 'DEF');
  const arquero = misJugadores.find((j) => j.pos === 'POR');
  const pick = (arr) => arr.length ? arr[Math.floor(Math.random() * arr.length)] : misJugadores[0];

  for (let i = 0; i < numJugadas; i++) {
    const minuto = Math.round(((i + 1) / (numJugadas + 1)) * 90);
    const necesitaGolMio = golesMios < gf && (numJugadas - i) <= (gf - golesMios + gc - golesRival);
    const necesitaGolRival = golesRival < gc && (numJugadas - i) <= (gc - golesRival);

    if (necesitaGolMio && (Math.random() > 0.4 || !necesitaGolRival)) {
      const autor = pick(delanteros.length ? delanteros : medios.length ? medios : misJugadores);
      golesMios++;
      jugadas.push({ min: minuto, tipo: 'gol', equipo: 'mio', zona: 4, jugador: autor,
        texto: `⚽ ${minuto}' ¡GOL! ${autor.nombre} no perdona` });
    } else if (necesitaGolRival) {
      golesRival++;
      const defensor = pick(defensas.length ? defensas : misJugadores);
      jugadas.push({ min: minuto, tipo: 'gol', equipo: 'rival', zona: 0, jugador: defensor,
        texto: `⚽ ${minuto}' Gol de ${rival}. ${defensor.nombre} no llega a cortar` });
    } else {
      const plantillas = [
        () => { const j = pick(medios.length ? medios : misJugadores); return { zona: 2, jugador: j, texto: `🏃 ${minuto}' ${j.nombre} conduce por el medio` }; },
        () => { const j = pick(delanteros.length ? delanteros : misJugadores); return { zona: 3, jugador: j, texto: `⚡ ${minuto}' ${j.nombre} se infiltra por la banda` }; },
        () => { const j = pick(defensas.length ? defensas : misJugadores); return { zona: 1, jugador: j, texto: `🛡️ ${minuto}' ${j.nombre} corta el avance rival` }; },
        () => { if (!arquero) { const j = pick(misJugadores); return { zona: 0, jugador: j, texto: `🧤 ${minuto}' Atajadón del arquero` }; } return { zona: 0, jugador: arquero, texto: `🧤 ${minuto}' ${arquero.nombre} despeja con seguridad` }; },
        () => ({ zona: 2, jugador: null, texto: `💨 ${minuto}' ${rival} presiona pero no encuentra espacios` }),
        () => { const j = pick(misJugadores); return { zona: 3, jugador: j, texto: `🎯 ${minuto}' Tiro de ${j.nombre}, se va desviado` }; },
      ];
      const p = plantillas[Math.floor(Math.random() * plantillas.length)]();
      jugadas.push({ min: p.min || minuto, tipo: 'jugada', equipo: 'mio', zona: p.zona, jugador: p.jugador, texto: p.texto });
    }
  }
  // Asegurar que los goles pendientes se meten
  while (golesMios < gf) {
    const autor = pick(delanteros.length ? delanteros : misJugadores);
    golesMios++;
    jugadas.push({ min: 88, tipo: 'gol', equipo: 'mio', zona: 4, jugador: autor,
      texto: `⚽ 88' ¡GOL! ${autor.nombre} sentencia el partido` });
  }
  while (golesRival < gc) {
    golesRival++;
    jugadas.push({ min: 89, tipo: 'gol', equipo: 'rival', zona: 0,
      texto: `⚽ 89' Gol de ${rival} sobre el final` });
  }
  return jugadas;
}

function renderSimModal(partido, idx, total, misJugadores, jugadaActual, jugadas, mostrandoResultado) {
  // ── Cancha vertical: fichas con position:absolute ──
  const posGroups = { POR: [], DEF: [], MED: [], DEL: [] };
  misJugadores.forEach((j) => { (posGroups[j.pos] || posGroups.MED).push(j); });

  const fichaActiva = jugadaActual >= 0 && jugadas[jugadaActual]?.jugador?.id;
  const jugadaActiva = jugadaActual >= 0 ? jugadas[jugadaActual] : null;

  const MY_TOP = { POR: 88, DEF: 73, MED: 53, DEL: 33 };
  const ZONA_TARGET = [88, 73, 53, 33, 10]; // target por zona 0-4
  const spread = (n) => n <= 1 ? [50] : Array.from({ length: n }, (_, i) => 15 + (70 * i) / (n - 1));

  const misFichas = [];
  for (const [pos, jugadores] of Object.entries(posGroups)) {
    const xs = spread(jugadores.length);
    jugadores.forEach((j, i) => {
      const top = MY_TOP[pos] ?? 53;
      const left = xs[i];
      const isActive = j.id === fichaActiva;
      const isGol = isActive && jugadaActiva?.tipo === 'gol' && jugadaActiva?.equipo === 'mio';
      const cls = isActive ? (isGol ? ' active gol' : ' active') : '';
      let style = `top:${top}%;left:${left}%`;
      if (isActive && jugadaActiva) {
        const tTop = ZONA_TARGET[jugadaActiva.zona] ?? 53;
        style += `;--to-top:${tTop}%;--to-left:50%`;
      }
      misFichas.push(`<div class="sim-ficha${cls}" style="${style}" data-name="${esc(j.nombre)}">${esc(j.nombre.split(' ').pop())}</div>`);
    });
  }

  const rivalSpec = [
    { pos: 'POR', top: 8, left: 50 },
    { pos: 'DEF', top: 22, left: 35 }, { pos: 'DEF', top: 22, left: 65 },
    { pos: 'MED', top: 45, left: 35 }, { pos: 'MED', top: 45, left: 65 },
    { pos: 'DEL', top: 65, left: 50 },
  ];
  const rivalFichas = rivalSpec.map((r) => {
    const isRivalGoal = jugadaActiva?.equipo === 'rival' && jugadaActiva?.tipo === 'gol' && r.pos === 'DEL';
    return `<div class="sim-ficha rival${isRivalGoal ? ' active-rival' : ''}" style="top:${r.top}%;left:${r.left}%" data-name="${r.pos} Rival">${r.pos}</div>`;
  }).join('');

  const zonas = misFichas.join('') + rivalFichas;

  const marcadorTexto = jugadaActual >= 0
    ? jugadas.slice(0, jugadaActual + 1).reduce((acc, j) => {
        if (j.tipo === 'gol') j.equipo === 'mio' ? acc[0]++ : acc[1]++;
        return acc;
      }, [0, 0]).join(' - ')
    : '0 - 0';

  const narrTexto = jugadaActual >= 0 && jugadas[jugadaActual]
    ? jugadas[jugadaActual].texto
    : `⏱️ Arranca el partido contra ${partido.rival}`;

  const progreso = Array.from({ length: total }, (_, i) =>
    `<i class="${i < idx ? 'done' : i === idx ? 'on' : ''}"></i>`).join('');

  if (mostrandoResultado) {
    const resLabel = partido.res === 'G' ? '¡Victoria!' : partido.res === 'E' ? 'Empate' : 'Derrota';
    return `<div class="sim-overlay" id="sim-overlay">
      <div class="sim-modal">
        <div class="sim-progreso">${progreso}</div>
        <div class="sim-resultado">
          <div class="eyebrow">${partido.localia === 'L' ? 'Local' : 'Visitante'} vs ${esc(partido.rival)}</div>
          <h2 class="res ${partido.res}">${resLabel}</h2>
          <div class="sim-header"><span></span><span class="sim-marcador">${partido.gf} - ${partido.gc}</span></div>
        </div>
        <button class="btn ts-cta" id="sim-continuar">Continuar</button>
      </div>
    </div>`;
  }

  return `<div class="sim-overlay" id="sim-overlay">
    <div class="sim-modal">
      <div class="sim-progreso">${progreso}</div>
      <div class="sim-header">
        <h3>${partido.localia === 'L' ? 'Local' : 'Visitante'} vs ${esc(partido.rival)}</h3>
        <span class="sim-marcador">${marcadorTexto}</span>
      </div>
      <div class="sim-cancha">${zonas}</div>
      <div class="sim-narr" id="sim-narr">${narrTexto}</div>
      <div class="row"><button class="btn ghost" id="sim-skip">Saltar animación</button><button class="btn ghost" id="sim-skip-all">Saltar todo</button></div>
    </div>
  </div>`;
}

async function mostrarSimulacionVisual() {
  const partidos = c.ultimoTramo.partidos;
  const porId = new Map(c.plantel.map((x) => [x.id, x]));
  const misJugadores = c.once.map((id) => porId.get(id)).filter(Boolean);
  let skipAll = false;

  for (let idx = 0; idx < partidos.length; idx++) {
    if (skipAll) break;
    const partido = partidos[idx];
    const jugadas = generarJugadas(partido, misJugadores);
    let skip = false;

    // Render inicial
    const contenedor = document.createElement('div');
    contenedor.innerHTML = renderSimModal(partido, idx, partidos.length, misJugadores, -1, jugadas, false);
    document.body.appendChild(contenedor.firstElementChild);

    const overlay = document.getElementById('sim-overlay');
    document.getElementById('sim-skip')?.addEventListener('click', () => { skip = true; });
    document.getElementById('sim-skip-all')?.addEventListener('click', () => { skip = true; skipAll = true; });

    // Animar jugadas
    for (let j = 0; j < jugadas.length; j++) {
      if (skip || skipAll) break;
      await new Promise((r) => setTimeout(r, 1500));
      if (skip || skipAll) break;
      const tmp = document.createElement('div');
      tmp.innerHTML = renderSimModal(partido, idx, partidos.length, misJugadores, j, jugadas, false);
      overlay.replaceChildren(...tmp.firstElementChild.children);
      document.getElementById('sim-skip')?.addEventListener('click', () => { skip = true; });
      document.getElementById('sim-skip-all')?.addEventListener('click', () => { skip = true; skipAll = true; });
    }

    // Mostrar resultado
    if (skipAll) { overlay.remove(); continue; }
    await new Promise((r) => setTimeout(r, skip ? 300 : 1200));
    const tmp2 = document.createElement('div');
    tmp2.innerHTML = renderSimModal(partido, idx, partidos.length, misJugadores, jugadas.length - 1, jugadas, true);
    overlay.replaceChildren(...tmp2.firstElementChild.children);

    // Esperar click en continuar
    await new Promise((resolve) => {
      document.getElementById('sim-continuar')?.addEventListener('click', resolve);
    });

    overlay.remove();
  }
}

// ── onboarding visual ──
// País de origen: dropdown con bandera (flagcdn.com). El valor guardado es el
// nombre del país, que es lo que se persiste en `managers.country`.
const PAISES = [
  ['Argentina', 'ar'], ['Brasil', 'br'], ['Uruguay', 'uy'], ['Chile', 'cl'],
  ['Colombia', 'co'], ['Perú', 'pe'], ['Paraguay', 'py'], ['Bolivia', 'bo'],
  ['Ecuador', 'ec'], ['Venezuela', 've'], ['México', 'mx'], ['Estados Unidos', 'us'],
  ['España', 'es'], ['Italia', 'it'], ['Inglaterra', 'gb-eng'], ['Francia', 'fr'],
  ['Alemania', 'de'], ['Portugal', 'pt'], ['Países Bajos', 'nl'], ['Bélgica', 'be'],
  ['Croacia', 'hr'], ['Japón', 'jp'], ['Nigeria', 'ng'], ['Marruecos', 'ma'],
];
const BANDERAS = new Map(PAISES);

// Modo País: país del DT → EA FC 26 nation ID (nationality_id en cards).
// IDs confirmados desde la DB; países sin ID quedan en null (pool global).
const PAIS_A_NACION_ID = new Map([
  ['Argentina',      52],
  ['Brasil',         54],
  ['Colombia',      133],
  ['México',        163],
  ['Estados Unidos', 95],
  ['España',         45],
  ['Italia',         27],
  ['Inglaterra',     14],
  ['Francia',        18],
  ['Alemania',       21],
  ['Países Bajos',   34],
  ['Portugal',       38],
  ['Uruguay',        60],
  ['Chile',          56],
  ['Paraguay',      158],
  ['Bolivia',       157],
  ['Ecuador',       155],
  ['Venezuela',     161],
  ['Bélgica',         7],
  ['Croacia',        10],
  ['Japón',          29],
  ['Nigeria',        35],
  ['Marruecos',      32],
]);

const FORMACIONES_UI = [
  { id: '4-3-3',   label: '4-3-3',   desc: 'Ofensivo' },
  { id: '4-4-2',   label: '4-4-2',   desc: 'Equilibrado' },
  { id: '4-2-3-1', label: '4-2-3-1', desc: 'Control' },
  { id: '3-5-2',   label: '3-5-2',   desc: 'Mediocampo' },
  { id: '3-4-2-1', label: '3-4-2-1', desc: 'Creativo' },
  { id: '5-3-2',   label: '5-3-2',   desc: 'Defensivo' },
];

// Índices de slots por línea para cada formación.
// Los índices corresponden a la posición en el array de FORMACIONES_SLOTS.
// El orden dentro de cada línea es izquierda→derecha en la pantalla.
const LINEAS_POR_FORMACION = {
  '4-3-3':   [[0], [3,1,2,4],   [5,6,7],     [8,10,9]],
  '4-4-2':   [[0], [3,1,2,4],   [5,6,7,8],   [9,10]],
  '4-2-3-1': [[0], [3,1,2,4],   [5,6],       [8,7,9],  [10]],
  '3-5-2':   [[0], [1,2,3],     [7,4,5,6,8], [9,10]],
  '3-4-2-1': [[0], [1,2,3],     [6,4,5,7],   [8,9],    [10]],
  '5-3-2':   [[0], [4,1,2,3,5], [6,7,8],     [9,10]],
};

const MODOS_JUEGO_UI = [
  { id: 'liga',      ico: '⚽', nombre: 'Liga',      desc: 'Solo cartas de tu liga' },
  { id: 'global',    ico: '🌍', nombre: 'Global',    desc: 'Todas las ligas' },
  { id: 'budget',    ico: '💸', nombre: 'Budget',    desc: '$4M para arrancar' },
  { id: 'draft',     ico: '🎲', nombre: 'Draft',     desc: 'Elegís 1 de 4 por carta' },
  { id: 'pais',      ico: '🏴', nombre: 'País',      desc: 'Cartas de tu país' },
  { id: 'club_real', ico: '🏟️', nombre: 'Club Real', desc: 'Plantilla oficial del club elegido + 1 sobre' },
];
const banderaImg = (nombre) => {
  const code = BANDERAS.get(nombre);
  return code
    ? `<img class="flag" src="https://flagcdn.com/w40/${code}.png" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" />`
    : '';
};

// Botones de liga con logo oficial (CDN público temporal; onerror lo oculta).
// ids = cards.league_id: el draft y el motor las usan tal cual.
const LIGAS = [
  { id: 'premier',     label: 'Premier League',           logo: 'https://media.api-sports.io/football/leagues/39.png'  },
  { id: 'laliga',      label: 'LaLiga',                   logo: 'https://media.api-sports.io/football/leagues/140.png' },
  { id: 'liga-profesional', label: 'Liga Profesional', logo: 'https://paladarnegro.net/escudoteca/argentina/liga-profesional/png/bocajuniors.png' },
  { id: 'seriea',      label: 'Serie A',                  logo: 'https://media.api-sports.io/football/leagues/135.png' },
  { id: 'bundesliga',  label: 'Bundesliga',               logo: 'https://media.api-sports.io/football/leagues/78.png'  },
  { id: 'ligapro',     label: 'Liga Profesional',         logo: 'https://media.api-sports.io/football/leagues/128.png' },
  { id: 'mls',         label: 'MLS',                      logo: 'https://media.api-sports.io/football/leagues/253.png' },
  { id: 'ligue1',      label: 'Ligue 1',                  logo: 'https://media.api-sports.io/football/leagues/61.png'  },
];

// Escudo del club: badge real de la fila de `clubs` (badge_url /
// club_badge_url / badge) → si no viene, la teca local por nombre
// (data/escudoteca.js: Paladar Negro + api-sports) → si tampoco, SVG
// generado por nombre (badgeGenerator.js). El escudo SIEMPRE se ve.
const escudoDe = (cl) => {
  const badge = cl.badge_url || cl.club_badge_url || cl.badge || '';
  const src = badge || escudoDeNombre(cl.name) || '';
  const fallback = generateClubBadgeDataURI(cl.name);
  return src
    ? `<img class="escudo" src="${esc(src)}" alt="" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${fallback}'" />`
    : `<img class="escudo" src="${fallback}" alt="" />`;
};

// Escudo de cualquier equipo de la liga (rivales y el propio cuando no hay
// badge de Supabase): misma teca local y mismo fallback que escudoDe.
const escudoRival = (nombre) => {
  const src = escudoDeNombre(nombre) || '';
  const fallback = generateClubBadgeDataURI(nombre);
  return src
    ? `<img class="escudo" src="${esc(src)}" alt="" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${fallback}'" />`
    : `<img class="escudo" src="${fallback}" alt="" />`;
};

// Escudo de CUALQUIER equipo de la tabla, mío o rival. Para el mío usa el
// badge real que trajo Supabase en el onboarding (ui.miEscudo); si no hay
// (o falla), cae al mismo generador por nombre que usan los rivales — nunca
// queda un club sin escudo en pantalla.
const escudoClub = (nombre) => {
  if (c && nombre === c.club && ui.miEscudo) {
    const fallback = generateClubBadgeDataURI(nombre);
    return `<img class="escudo" src="${esc(ui.miEscudo)}" alt="" referrerpolicy="no-referrer" onerror="this.src='${fallback}'" />`;
  }
  return escudoRival(nombre);
};

// Para fatiga/presión el "+" confunde (subir es malo): usamos flecha de dirección.
// Para el resto, "+"/"−" es intuitivo: "+" siempre es bueno.
function signoDelta(k, v) {
  if (MALO_SI_SUBE.has(k)) return v === 0 ? '±' : v > 0 ? '▲' : '▼';
  return v > 0 ? '+' : '−';
}

function chip(k, v) {
  if (v === 0) return `<span class="chip">${ICONO[k]} 0</span>`;
  const bueno = MALO_SI_SUBE.has(k) ? v < 0 : v > 0;
  return `<span class="chip ${bueno ? 'pos' : 'neg'}">${ICONO[k]} ${signoDelta(k, v)}${Math.abs(v)}</span>`;
}

const STAT_MAX = { money: 10, moral: 15, fatiga: 15, presion: 15, ratingDelta: 5 };

function statRow(k, v) {
  if (v === 0) return '';
  const bueno = MALO_SI_SUBE.has(k) ? v < 0 : v > 0;
  const cls = bueno ? 'pos' : 'neg';
  const pct = Math.min(100, Math.round(Math.abs(v) / (STAT_MAX[k] || 10) * 100));
  const signo = MALO_SI_SUBE.has(k) ? (v > 0 ? '▲' : '▼') : (v > 0 ? '+' : '−');
  const label = k === 'money' ? `${signo}${Math.abs(v)}M` : `${signo}${Math.abs(v)}`;
  return `<div class="stat-row">
    <span class="stat-lbl">${NOMBRE_VAR[k]}</span>
    <div class="stat-track"><div class="stat-fill ${cls}" style="width:${pct}%"></div></div>
    <span class="stat-val ${cls}">${label}</span>
  </div>`;
}

function probLabel(prob) {
  if (prob >= 0.65) return 'Lo más probable';
  if (prob >= 0.45) return 'Posible';
  return 'Menos probable';
}

function splitBar(resultados) {
  const maxProb = Math.max(...resultados.map(r => r.prob));
  const segs = resultados.map(r => {
    const pct = Math.round(r.prob * 100);
    const isTop = r.prob === maxProb;
    return `<div class="split-seg${isTop ? ' top' : ''}" style="flex:${pct}" title="${pct}%"></div>`;
  }).join('<div class="split-gap"></div>');
  return `<div class="split-bar-wrap">
    <div class="split-bar">${segs}</div>
  </div>`;
}

// Tira fija arriba de las opciones: qué mueve cada variable, siempre a la vista
// en el momento de decidir (antes esto solo vivía en la guía, un tap aparte).
function leyendaVars() {
  const orden = ['moral', 'fatiga', 'presion', 'ratingDelta', 'money'];
  return `<div class="leyenda-vars">${orden.map((k) =>
    `<div class="leyenda-item"><span class="li-ico">${ICONO[k]}</span><span class="li-tx"><b>${NOMBRE_VAR[k]}</b> ${EXPLICACION_VAR[k]}</span></div>`
  ).join('')}</div>`;
}

// Promedio ponderado por probabilidad de cada efecto: reduce dos (o más)
// bloques de números a UNA sola foto de "para dónde empuja" la opción, en vez
// de mostrar cada resultado posible por separado (eso es lo que generaba la
// pared de rojos: el resultado menos probable se veía tan grande como el otro).
function valorEsperado(opcionCat) {
  if (!opcionCat.resultado) return opcionCat.efectos;
  const acc = {};
  for (const r of opcionCat.resultado) {
    for (const [k, v] of Object.entries(r.efectos)) acc[k] = (acc[k] || 0) + v * r.prob;
  }
  return acc;
}

function chipEsperado(k, v) {
  const r = Math.round(v * 10) / 10;
  if (Math.abs(r) < 0.05) return `<span class="chip">${ICONO[k]} ±0</span>`;
  const bueno = MALO_SI_SUBE.has(k) ? r < 0 : r > 0;
  const mag = Number.isInteger(r) ? Math.abs(r) : Math.abs(r).toFixed(1);
  return `<span class="chip ${bueno ? 'pos' : 'neg'}" title="Promedio esperado según probabilidad de cada resultado">${ICONO[k]} ${signoDelta(k, r)}${mag}</span>`;
}

function chipsEsperados(opcionCat) {
  const v = valorEsperado(opcionCat);
  const entradas = Object.entries(v).filter(([, val]) => Math.abs(val) >= 0.05);
  if (!entradas.length) return `<span class="chip">Sin cambios</span>`;
  return entradas.map(([k, val]) => chipEsperado(k, val)).join('');
}

function resultadoBloque(efectos, prob, isTopProb) {
  const filas = Object.entries(efectos).map(([k, v]) => statRow(k, v)).filter(Boolean).join('');
  const probPct = prob != null ? Math.round(prob * 100) : null;
  const header = probPct != null
    ? `<div class="res-header">
        <span class="res-label${isTopProb ? ' top' : ''}">${probLabel(prob)}</span>
        <span class="prob-badge">${probPct}%</span>
      </div>`
    : '';
  return `<div class="res-bloque${isTopProb ? ' top' : ''}">
    ${header}
    <div class="stat-rows">${filas || '<span class="sin-cambios">Sin cambios</span>'}</div>
  </div>`;
}

// money se guarda en millones (1 decimal, ver state.js/balance.js); la UI lo
// muestra como dólares enteros con separador de miles en puntos (formato es-AR).
const fmtMoney = (v) => 'U$D ' + String(Math.round(v * 1_000_000)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');


const LABEL_RAREZA = { bronce: 'Bronce', oro_comun: 'Oro común', oro_unico: 'Oro único', epica: 'Épica' };

// slot: si viene, la carta muestra su rating EN ESE PUESTO ("88 → 82") y el motivo del descuento.
// i: índice dentro de la grilla, maneja el reveal escalonado (--i).
function carta(x, { sel = false, accion = '', slot = null, bloqueada = false, motivo = '', i = 0, draggable: drag = false } = {}) {
  const pen = slot ? penalidad(x.pos, slot) : 0;
  const efectivo = slot ? ratingEnSlot(x, slot) : x.rating;
  const clasePen = pen === 0 ? '' : pen === FUERZA.PENALIDAD_POSICION.VECINO ? ' pen-vecino' : ' pen-fuera';
  const num = pen === 0
    ? `<div class="num">${efectivo}</div>`
    : `<div class="num-cambio"><span class="orig">${x.rating}</span><span class="flecha">→</span><span class="efectivo">${efectivo}</span></div>`;
  const attrs = accion && !bloqueada ? `data-accion="${accion}" data-id="${x.id}"` : '';
  const dragAttrs = drag ? ` draggable="true" data-player-id="${x.id}" data-drop-type="bench"` : '';
  return `<div class="carta-slot" style="--i:${i}">
    <div class="card${clasePen} ${sel ? 'sel' : ''} ${bloqueada ? 'bloqueada' : ''}" data-rarity="${x.rareza}" ${attrs}${dragAttrs}>
      <div class="card-inner">
        <div class="rays"></div>
        <div class="photo-well"><img src="${x.foto ? esc(x.foto) : SIL_CARTA}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='${SIL_CARTA}'"></div>
        <div class="glint"></div>
        <div class="foil"></div>
        <div class="flash"></div>
        <div class="ovr">${num}<div class="pos">${x.pos}</div></div>
        <div class="foot">
          <div class="name">${esc(x.nombre)}</div>
          <div class="metarow"><span class="age">${motivo || `${x.edad} años`}</span><span class="rarity-chip">${LABEL_RAREZA[x.rareza] || x.rareza}</span></div>
        </div>
      </div>
    </div>
  </div>`;
}

// ───────────────────────── el marcador (signature) ─────────────────────────
function marcador() {
  const pos = c.liga ? miPosicion(c.liga) : null;
  const g = (k) => {
    const v = c.estado[k];
    const [min, max] = RANGOS[k];
    const tope = k === 'money' ? 60 : max;
    const pctv = Math.max(0, Math.min(100, ((v - (k === 'money' ? 0 : min)) / (tope - (k === 'money' ? 0 : min))) * 100));
    const critico = k === 'presion' ? v >= 80 : k === 'fatiga' ? v >= 80 : k === 'moral' ? v <= 25 : false;
    const alerta = k === 'presion' ? v >= 60 : k === 'fatiga' ? v >= 60 : k === 'moral' ? v <= 40 : false;
    const d = ui.deltas?.[k];
    const circum = (Math.PI * 26).toFixed(1);
    const offset = (Math.PI * 26 * (1 - pctv / 100)).toFixed(1);
    const stroke = critico ? '#FF4A4A' : alerta ? '#FFC24B' : '#6FE39A';
    const dv = k === 'money'
      ? (v < 1 ? Math.round(v * 1000) + 'K' : (v % 1 < 0.05 ? Math.round(v) + 'M' : v.toFixed(1) + 'M'))
      : v;
    return `<div class="gauge ${critico ? 'bad' : alerta ? 'warn' : ''}">
      <div class="gauge-arc-wrap">
        <svg class="gauge-arc-svg" viewBox="0 0 64 36" fill="none">
          <path d="M6 32 A26 26 0 0 1 58 32" stroke="rgba(255,255,255,.09)" stroke-width="5" stroke-linecap="round" fill="none"/>
          <path d="M6 32 A26 26 0 0 1 58 32" stroke="${stroke}" stroke-width="5" stroke-linecap="round" fill="none"
            style="stroke-dasharray:${circum};stroke-dashoffset:${offset};transition:stroke-dashoffset .6s cubic-bezier(.2,.7,.2,1),stroke .3s"/>
        </svg>
        ${d ? `<span class="gauge-delta ${d === 0 ? '' : (MALO_SI_SUBE.has(k) ? d < 0 : d > 0) ? 'pos' : 'neg'}">${signoDelta(k, d)}${Math.abs(d)}</span>` : ''}
      </div>
      <div class="gauge-arc-val">${dv}</div>
      <div class="gauge-lbl">${ICONO[k]} ${NOMBRE_VAR[k]}</div>
      <div class="gauge-hint">${HINT_VAR[k]}</div>
    </div>`;
  };
  const cinta = c.liga ? `<div class="cinta">${Array.from({ length: LIGA.FECHAS }, (_, i) => {
    const p = c.partidosTemporada[i];
    return `<i class="${p ? p.res : ''} ${i === c.partidosTemporada.length ? 'hoy' : ''}"></i>`;
  }).join('')}</div>` : '';

  return `<div class="marcador">
    <div class="top">
      <div class="club">${escudoClub(c.club)}<span>${esc(c.club)}</span></div>
      <div class="ts-meta">
        <div class="ts-steps" title="Temporadas: ${c.temporada} de ${CARRERA.TEMPORADAS}">${Array.from({ length: CARRERA.TEMPORADAS }, (_, i) => `<i class="${i + 1 < c.temporada ? 'done' : i + 1 === c.temporada ? 'on' : ''}"></i>`).join('')}</div>
        <span class="ts-chip">Tramo <b>${Math.min(c.tramo + 1, LIGA.TRAMOS.length)}/${LIGA.TRAMOS.length}</b></span>
        <span class="ts-chip">Fecha <b>${Math.min(c.partidosTemporada.length + 1, LIGA.FECHAS)}</b></span>
        <span class="ts-chip">Puesto <b>${pos ? `${pos}°` : '—'}</b></span>
        <span class="ts-chip">Objetivo <b>${c.objetivo}°</b></span>
        <button class="btn ghost ts-guia" data-accion="ver-guia" title="Cómo funcionan las variables">?</button>
      </div>
    </div>
    <div class="gauges">${['money', 'moral', 'fatiga', 'presion', 'ratingDelta'].map(g).join('')}</div>
    ${cinta}
  </div>`;
}

// Tabla de posiciones pro: columnas completas (PJ/G/E/P/DG/Pts), DG coloreado
// por bueno/malo y zonas a una mirada sin semántica inventada (no hay champions
// acá): led = puesto que cumple el objetivo del club, rojo = zona de descenso.
// En móvil se ocultan G/E/P (patrón de las apps de fútbol).
function tablaPosiciones() {
  if (!c.liga) return '';
  const t = posiciones(c.liga);
  const n = t.length;
  const riesgo = 3;
  return `<div class="panel stack ts-panel">
    <div class="row" style="justify-content:space-between">
      <div class="eyebrow">Tabla de posiciones</div>
      <button class="btn ghost" data-accion="tabla">${ui.tabla ? 'Ocultar' : 'Ver tabla'}</button>
    </div>
    ${ui.tabla ? `<table class="ts-tabla pro"><thead><tr>
        <th class="n th-pos">#</th><th>Equipo</th><th class="n">PJ</th><th class="n oc">G</th><th class="n oc">E</th><th class="n oc">P</th><th class="n">DG</th><th class="n th-pts">Pts</th>
      </tr></thead>
      <tbody>${t.map((e, i) => {
        const pos = i + 1;
        const zona = e.id !== 0
          ? (pos <= c.objetivo ? 'zona-obj' : pos > n - riesgo ? 'zona-riesgo' : '')
          : '';
        return `<tr class="${e.id === 0 ? 'mio' : zona}">
          <td class="n pos-num">${pos}</td>
          <td class="eq">${escudoClub(e.nombre)}<span>${esc(e.nombre)}</span></td>
          <td class="n">${e.pj}</td><td class="n oc">${e.g}</td><td class="n oc">${e.e}</td><td class="n oc">${e.p}</td>
          <td class="n ${e.dg > 0 ? 'dg-pos' : e.dg < 0 ? 'dg-neg' : ''}">${e.dg > 0 ? '+' + e.dg : e.dg < 0 ? e.dg : '0'}</td>
          <td class="n pts">${e.pts}</td>
        </tr>`;
      }).join('')}</tbody></table>` : ''}
  </div>`;
}

// Goleadores/asistencias de la temporada — SOLO de mi plantel: los rivales no
// tienen jugadores simulados, solo un número de fuerza (§liga.js), así que no
// hay a quién más atribuirle goles sin inventar jugadores que no existen.
// Ranking profesional: medallas, avatar, barra contra el líder y cifra grande.
function tablaGoleadores(estadisticas) {
  const est = estadisticas || c.estadisticas;
  if (!est) return '';
  const porId = new Map(c.plantel.map((x) => [x.id, x]));
  const top = (obj) => Object.entries(obj)
    .map(([id, n]) => ({ jugador: porId.get(id), n }))
    .filter((x) => x.jugador)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
  const goleadores = top(est.goleadores);
  const asistencias = top(est.asistencias);
  if (!goleadores.length && !asistencias.length) return '';
  const MEDALLAS = ['🥇', '🥈', '🥉'];
  const col = (titulo, lista, tipo) => `<div class="stack gol-col ${tipo}">
    <div class="gol-head"><span class="eyebrow">${titulo}</span></div>
    ${lista.length
      ? `<div class="gol-lista">${lista.map((x, i) => {
          const j = x.jugador;
          const pct = Math.max(5, Math.round((x.n / lista[0].n) * 100));
          return `<div class="gol-fila">
            <span class="gol-rank">${i < 3 ? MEDALLAS[i] : i + 1}</span>
            <img class="gol-avatar" src="${j.foto ? esc(j.foto) : SIL_CARTA}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='${SIL_CARTA}'">
            <div class="gol-id"><div class="gol-nombre">${esc(j.nombre)}</div><div class="gol-pos">${j.pos}</div></div>
            <div class="gol-track"><i style="width:${pct}%"></i></div>
            <div class="gol-num">${x.n}</div>
          </div>`;
        }).join('')}</div>`
      : `<p class="hint">Todavía nadie.</p>`}
  </div>`;
  return `<div class="panel stack ts-panel">
    <div class="eyebrow">Goleadores y asistencias · ${esc(c.club)}</div>
    <div class="row gol-row">${col('⚽ Goleadores', goleadores, 'gol')}${col('🅰️ Asistencias', asistencias, 'asist')}</div>
  </div>`;
}

// ───────────────────────── pantallas ─────────────────────────
const PANTALLAS = {
  onboarding: () => {
    const ob = ui.onboarding;
    const clubSel = ob.clubes.find((cl) => cl.id === ob.clubId);
    const ligaSel = LIGAS.find((l) => l.id === ob.liga);
    const clubBtn = !ob.liga
      ? 'Elegí una liga primero'
      : ob.cargando
        ? 'Cargando clubes…'
        : ob.clubes.length === 0
          ? 'No hay clubes para esta liga'
          : clubSel ? clubSel.name : 'Elegí tu club';
    // Ficha viva: cada campo completado se ve reflejado al instante en la tarjeta.
    const nombre = ob.nombre.trim() || 'DT';
    const inicial = (nombre[0] || 'D').toUpperCase();
    const fichaCompleta = !!(ob.nombre.trim() && ob.pais && ob.liga && ob.clubId);
    const anim = obPrimeraVezOnboarding ? ' ob-anim' : '';
    obPrimeraVezOnboarding = false;
    const paso = (n, ok) => `<span class="ob-step${ok ? ' done' : ''}"><i></i>${n}</span>`;
    return `
    <div class="ob-wrap${anim}">
      <header class="ob-hero">
        <div class="eyebrow">Antes de arrancar</div>
        <h1 class="ob-h1">Creá tu <span class="ob-h1-glow">perfil</span> de DT</h1>
        <p class="ob-sub">Una sola vez: tu identidad, tu club y 3 sobres gratis para arrancar la carrera.</p>
        <nav class="ob-steps" aria-label="Progreso del perfil">
          ${paso('Identidad', !!(ob.nombre.trim() && ob.pais))}<span class="ob-step-arrow"></span>
          ${paso('Club', !!(ob.liga && ob.clubId))}<span class="ob-step-arrow"></span>
          ${paso('Contrato', !!ob.enviando)}
        </nav>
      </header>

      <div class="ob-layout">
        <div class="panel ob-form stack" role="form">
          <label class="eyebrow" for="ob-dt">Tu nombre</label>
          <input id="ob-dt" maxlength="24" placeholder="Nombre del DT" value="${esc(ob.nombre)}" autocomplete="off" />
          <label class="eyebrow">País de origen</label>
          <div class="dropdown">
            <button type="button" id="ob-pais" class="dd-btn${ob.pais ? '' : ' dd-placeholder'}" data-accion="ob-pais" aria-haspopup="listbox" aria-expanded="${ob.abierto === 'pais'}">
              ${ob.pais ? `${banderaImg(ob.pais)} ${esc(ob.pais)}` : 'Elegí tu país'}
              <span class="dd-caret">▾</span>
            </button>
            ${ob.abierto === 'pais' ? `<ul class="dd-opciones" role="listbox">
              ${PAISES.map((p) => `<li role="option" data-accion="ob-pais" data-pais="${esc(p[0])}" class="dd-item${ob.pais === p[0] ? ' activo' : ''}">${banderaImg(p[0])} ${esc(p[0])}</li>`).join('')}
            </ul>` : ''}
          </div>
          <label class="eyebrow">Liga</label>
          <div class="row">
            ${LIGAS.map((l) => `
            <button type="button" class="ob-liga${ob.liga === l.id ? ' activo' : ''}" data-accion="ob-liga" data-liga="${l.id}">
              <img class="liga-logo" src="${l.logo}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" />
              ${l.label}
            </button>`).join('')}
          </div>
          <label class="eyebrow">Club</label>
          <div class="dropdown">
            <button type="button" id="ob-club" class="dd-btn${clubSel ? '' : ' dd-placeholder'}" data-accion="ob-club" aria-haspopup="listbox" aria-expanded="${ob.abierto === 'club'}" ${!ob.liga || ob.cargando ? 'disabled' : ''}>
              ${clubSel ? escudoDe(clubSel) : ''}${clubBtn}
              <span class="dd-caret">▾</span>
            </button>
            ${ob.abierto === 'club' && ob.clubes.length > 0 ? `<ul class="dd-opciones" role="listbox">
              ${ob.clubes.map((cl) => `<li role="option" data-accion="ob-club" data-id="${esc(cl.id)}" class="dd-item${ob.clubId === cl.id ? ' activo' : ''}">${escudoDe(cl)} ${esc(cl.name)}</li>`).join('')}
            </ul>` : ''}
          </div>
          <label class="eyebrow">Modo de juego</label>
          <div class="row" style="flex-wrap:wrap;gap:6px">
            ${MODOS_JUEGO_UI.map((m) => `<button type="button" class="ob-liga${ob.modoJuego === m.id ? ' activo' : ''}" data-accion="ob-set-modo" data-modo="${m.id}" title="${m.desc}" style="flex-direction:column;align-items:center;gap:3px;padding:10px 14px;min-width:80px;font-size:13px"><span style="font-size:20px">${m.ico}</span><span>${m.nombre}</span></button>`).join('')}
          </div>
          <p class="hint">${(() => {
            const nacionId = PAIS_A_NACION_ID.get(ob.pais);
            return ({
              liga:      'Solo cartas de la liga elegida. El modo estándar.',
              global:    'Pool completo: jugadores de todas las ligas.',
              budget:    'Arrancás con $4M. Cada decisión económica duele.',
              draft:     'Elegís 1 de 4 cartas por slot. Sin economía inicial.',
              pais:      ob.pais
                ? (nacionId ? `Jugadores de ${ob.pais} en todas las ligas del mundo.` : `Pool global — ${ob.pais} aún sin datos de nacionalidad.`)
                : 'Elegí tu país para ver el pool disponible.',
              club_real: 'Arrancás con la plantilla oficial del club que elegiste. Recibís 1 sobre de refuerzo para sumar jugadores.',
            })[ob.modoJuego] || '';
          })()}</p>
          <label class="eyebrow">Dificultad</label>
          <div class="ob-seg" role="group" aria-label="Dificultad">
            <button type="button" class="ob-seg-btn${ob.modo === 'facil' ? ' activo' : ''}" data-accion="ob-modo" data-modo="facil">Accesible</button>
            <button type="button" class="ob-seg-btn${ob.modo === 'dificil' ? ' activo' : ''}" data-accion="ob-modo" data-modo="dificil">Difícil</button>
          </div>
          <p class="hint">${ob.modo === 'dificil'
            ? '⚠️ La presión escala fuerte en cada decisión. Sin épicas en el 11, el rendimiento tiene techo.'
            : 'Ideal para conocer el juego. Margen de error generoso, presión suave.'
          }</p>
          <label class="eyebrow">Formación</label>
          <div class="row" style="flex-wrap:wrap;gap:6px">
            ${FORMACIONES_UI.map((f) => `<button type="button" class="ob-liga${ob.formacion === f.id ? ' activo' : ''}" data-accion="ob-formacion" data-id="${f.id}" style="flex-direction:column;align-items:center;gap:2px;padding:8px 12px;min-width:70px;font-size:13px"><span style="font-size:15px;font-weight:700">${f.label}</span><span style="font-size:11px;opacity:.7">${f.desc}</span></button>`).join('')}
          </div>
          ${ob.error ? `<p class="aviso">${esc(ob.error)}</p>` : ''}
          <button class="btn ob-cta" data-accion="ob-confirmar" ${ob.enviando ? 'disabled' : ''}>${ob.enviando ? 'Creando perfil…' : 'Firmar contrato'}</button>
        </div>

        <aside class="ob-ficha${fichaCompleta ? ' lista' : ''}" aria-live="polite">
          <div class="ob-ficha-id">
            <div class="ob-ficha-avatar"><span id="ob-ficha-inicial">${inicial}</span></div>
            <div class="ob-ficha-nombre-wrap">
              <div class="eyebrow">Tu ficha</div>
              <div class="ob-ficha-nombre" id="ob-ficha-nombre">${esc(nombre)}</div>
            </div>
          </div>
          <div class="ob-ficha-fila"><span class="ob-ficha-lbl">País</span><span class="ob-ficha-val">${ob.pais ? `${banderaImg(ob.pais)} ${esc(ob.pais)}` : '—'}</span></div>
          <div class="ob-ficha-fila"><span class="ob-ficha-lbl">Liga</span><span class="ob-ficha-val">${ligaSel ? `<img class="liga-logo" src="${ligaSel.logo}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" />${esc(ligaSel.label)}` : '—'}</span></div>
          <div class="ob-ficha-fila"><span class="ob-ficha-lbl">Club</span><span class="ob-ficha-val">${clubSel ? `${escudoDe(clubSel)}${esc(clubSel.name)}` : '—'}</span></div>
          <div class="ob-ficha-fila"><span class="ob-ficha-lbl">Modo</span><span class="ob-ficha-val">${MODOS_JUEGO_UI.find((m) => m.id === ob.modoJuego)?.ico || '⚽'} ${MODOS_JUEGO_UI.find((m) => m.id === ob.modoJuego)?.nombre || 'Liga'}</span></div>
          <div class="ob-ficha-fila"><span class="ob-ficha-lbl">Dif.</span><span class="ob-ficha-val">${ob.modo === 'dificil' ? 'Difícil' : 'Accesible'}</span></div>
          <div class="ob-ficha-fila"><span class="ob-ficha-lbl">Formación</span><span class="ob-ficha-val">${ob.formacion || '4-3-3'}</span></div>
          <div class="ob-ficha-pie"><span class="ob-ficha-sobre">${ob.modoJuego === 'club_real' ? 'Plantilla oficial + ×1 sobre' : ob.modoJuego === 'draft' ? 'Draft: elegís 1 de 4' : '×3 sobres gratis'}</span></div>
        </aside>
      </div>
    </div>`;
  },

  intro: () => `
    <div class="stack" style="padding-top:8vh">
      <div class="eyebrow">Modo carrera · 8 temporadas</div>
      <h1>Dream<br>Team</h1>
      <p style="max-width:42ch;color:var(--humo)">Abrís tus primeros sobres, armás el plantel de tu vida y aguantás ocho temporadas. Cada lesión, cada oferta y cada ultimátum del vestuario te acerca a la gloria o al despido.</p>
      <div class="panel stack" style="max-width:440px">
        <label class="eyebrow" for="dt">Tu nombre</label>
        <input id="dt" value="Bilardo" maxlength="24" />
        <label class="eyebrow" for="club">Club</label>
        <select id="club">${CLUBES_JUGABLES.map((x, i) => `<option value="${i}">${x.nombre} — ${x.apodo}</option>`).join('')}</select>
        <button class="btn" data-accion="empezar">Firmar contrato</button>
        <button class="btn ghost" data-accion="ver-guia">Cómo funciona el juego</button>
      </div>
    </div>`,

  guia: () => `<div class="stack">
      <div class="row" style="justify-content:space-between">
        <div class="eyebrow">Manual del DT</div>
        <button class="btn ghost" data-accion="volver">← Volver</button>
      </div>
      <h2>Las cinco variables</h2>
      <p class="hint">Todo lo que te pasa en el club se reduce a estos cinco números. No hay nada oculto: cada decisión te muestra exactamente qué mueve, con los mismos íconos que vas a ver en los eventos.</p>

      <div class="panel stack">
        <h3>💰 Plata</h3>
        <p>Lo que tenés para reforzar el plantel. Sube por rendimiento (algo entra cada tramo por sponsors) y por vender jugadores en el sobre de refuerzo; baja cuando fichás o cuando el club te castiga en decisiones caras. No tiene techo de "peligro" — simplemente si no tenés, no podés fichar.</p>
      </div>

      <div class="panel stack">
        <h3>😊 Moral</h3>
        <p>Qué tan unido y confiado está el plantel. <b>Sube o baja el rendimiento del equipo directamente</b>: por encima de 50 suma fuerza en cada partido, por debajo resta. También tiende a volver sola hacia el medio (50) con el tiempo — no se queda pegada arriba ni abajo para siempre.</p>
        <p class="hint">Bajo ~40: el equipo empieza a rendir por debajo de su rating real. Es la variable que más rápido te hunde si la descuidás en varias decisiones seguidas.</p>
      </div>

      <div class="panel stack">
        <h3>🔋 Fatiga</h3>
        <p>El desgaste físico del plantel. Sube solo con cada tramo jugado (7 partidos cansan, no hay forma de evitarlo del todo) y se resetea fuerte en el receso entre temporadas. <b>Resta fuerza al equipo</b> cuanto más alta está — un plantel reventado juega peor aunque tenga el mismo rating en el papel.</p>
        <p class="hint">Arriba de ~60: empezás a notarlo en los resultados. Las decisiones de "descanso" existen justamente para bajarla a costa de otra cosa (moral, rating del tramo).</p>
      </div>

      <div class="panel stack">
        <h3>🔥 Presión</h3>
        <p>Qué tan cerca estás de que te echen. Sube cuando el equipo rinde peor de lo esperado o cuando quedás lejos del objetivo de la temporada; baja cuando lo cumplís o lo superás. <b>Si llega a 100, se termina la carrera ahí mismo — te despiden</b>, sin importar en qué temporada estés.</p>
        <p class="hint">Ojo: el club te exige cada vez más arriba con el paso de las temporadas (el objetivo se aprieta si veniste bien), así que sostener la presión baja se pone más difícil, no más fácil.</p>
      </div>

      <div class="panel stack">
        <h3>⭐ Nivel (rating del tramo)</h3>
        <p>Un modificador temporal a la fuerza del equipo que dejan algunas decisiones (fichar a alguien, forzar a un lesionado, meter doble turno de entrenamiento). Se sube y se baja como las otras cuatro, pero <b>se resetea a cero al cerrar cada temporada</b> — no se acumula carrera entera.</p>
      </div>

      <div class="sep"></div>
      <h2>Cómo se arma la fuerza del equipo</h2>
      <p>Cada tramo, tu fuerza real para jugar sale de una cuenta simple: <b>rating del 11 titular</b>, ajustado por moral, fatiga, presión y el modificador de nivel. Jugar a alguien fuera de su puesto natural también resta. Por eso un plantel con buen rating puede rendir mal si lo llevás fundido o desmoralizado — y uno más flojo puede sostenerse si lo cuidás.</p>

      <div class="sep"></div>
      <h2>El objetivo y el sobre de refuerzo</h2>
      <p>Cada temporada el club te pide terminar en una posición o mejor. Cumplirlo baja mucho la presión; no cumplirlo la sube fuerte. Al cerrar la temporada, tu posición final define la calidad del <b>sobre de refuerzo</b>: cuanto más arriba terminaste, mejores cartas te tocan para la temporada siguiente. Es la bisagra entre jugar bien y crecer el plantel.</p>

      <div class="sep"></div>
      <h2>Los íconos en cada decisión</h2>
      <p>Cada opción de un evento muestra sus consecuencias reales al lado del texto — el relato puede sonar dramático, pero los números nunca mienten ni se ocultan:</p>
      <div class="chips">${['money','moral','fatiga','presion','ratingDelta'].map((k)=>chip(k, MALO_SI_SUBE.has(k) ? -1 : 1)).join('')}</div>
      <p class="hint">Verde = te conviene en esa variable. Rojo = te cuesta. Fatiga y presión son al revés de las otras: ahí lo bueno es que <i>bajen</i>.</p>

      <div class="row"><button class="btn" data-accion="volver">Entendido</button></div>
    </div>`,

  sobres: () => {
    const abiertos = ui.sobresAbiertos;
    const todos = abiertos.length === c.sobresIniciales.length;
    return `<div class="stack">
      <div class="eyebrow">Paso 1 de 2 · Plantel inicial</div>
      <h2>Tus ${c.sobresIniciales.length} sobres</h2>
      <p class="hint">Lo que salga acá es con lo que arrancás la temporada 1. No hay repetición.</p>
      <div class="row">
        ${c.sobresIniciales.map((_, i) => abiertos.includes(i)
          ? `<button class="btn ghost" disabled>Sobre ${i + 1} abierto</button>`
          : `<button class="btn" data-accion="abrir-sobre" data-i="${i}">Abrir sobre ${i + 1}</button>`).join('')}
      </div>
      ${abiertos.length ? `<div class="grid-cartas">${abiertos.flatMap((i) => c.sobresIniciales[i]).map((x, i) => carta(x, { i })).join('')}</div>` : ''}
      ${todos ? `<div class="row"><button class="btn" data-accion="ir-once">Armar el 11</button></div>` : ''}
      <div class="row"><button class="btn ghost" data-accion="volver-onboarding">← Editar perfil de DT</button></div>
    </div>`;
  },

  once: () => {
    const formId = c.formacion || '4-3-3';
    const formSlots = FORMACIONES_SLOTS[formId] || FORMACION;
    const lineas = LINEAS_POR_FORMACION[formId] || LINEAS_POR_FORMACION['4-3-3'];
    const porId = new Map(c.plantel.map((x) => [x.id, x]));
    const banco = c.plantel.filter((x) => !c.once.includes(x.id));
    const vacios = slotsVacios(c.once);
    const sinArquero = vacios.some((i) => formSlots[i] === 'ARQ');
    const slot = (i) => {
      const x = porId.get(c.once[i]);
      const pen = x ? penalidad(x.pos, formSlots[i]) : 0;
      const clase = pen === 0 ? '' : pen === FUERZA.PENALIDAD_POSICION.VECINO ? 'vecino' : 'fuera';
      const efectivo = x ? ratingEnSlot(x, formSlots[i]) : null;
      const num = !x
        ? '<span class="slot-rating slot-rating-vacio">—</span>'
        : pen === 0
          ? `<span class="slot-rating">${efectivo}</span>`
          : `<span class="slot-rating">${efectivo}</span><span class="slot-orig">${x.rating}</span>`;
      const dragAttrs = x ? ` draggable="true" data-player-id="${x.id}" data-drop-type="slot" data-slot-index="${i}"` : '';
      return `<div class="slot ${ui.slot === i ? 'activo' : ''} ${clase} ${x ? '' : 'vacio'}" data-accion="slot" data-i="${i}"${dragAttrs}${x && x.nombre ? ` title="${esc(x.nombre)}"` : ''}>
        <div class="slot-card${x ? '' : ' slot-card-vacio'}" data-rarity="${x ? x.rareza : 'bronce'}">
          <div class="slot-card-inner">
            <div class="slot-photo"><img src="${x && x.foto ? esc(x.foto) : SIL_CARTA}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='${SIL_CARTA}'"></div>
            <div class="slot-head">
              <span class="slot-pos">${formSlots[i]}</span>
              <span class="slot-num">${num}</span>
            </div>
            <div class="slot-name">${x ? esc(x.nombre) : 'vacío'}</div>
          </div>
        </div>
      </div>`;
    };
    const slotElegido = ui.slot !== null ? formSlots[ui.slot] : null;
    const ocupante = ui.slot !== null ? c.once[ui.slot] : null;
    const candidatos = ui.slot === null ? [] : [...banco, ...c.once.map((id) => porId.get(id))].filter((x) => x && x.id !== ocupante)
      .sort((a, b) =>
        penalidad(a.pos, slotElegido) - penalidad(b.pos, slotElegido) ||
        ratingEnSlot(b, slotElegido) - ratingEnSlot(a, slotElegido));
    return `<div class="stack">
      <div class="eyebrow">${c.temporada === 1 ? 'Paso 2 de 2 · ' : `Temporada ${c.temporada} · `}Once titular · ${formId}</div>
      <h2>Rating del 11: <span style="color:var(--fluor)">${ratingActual(c)}</span></h2>
      <div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:2px">
        ${FORMACIONES_UI.map((f) => `<button type="button" class="ob-liga${formId === f.id ? ' activo' : ''}" data-accion="cambiar-formacion" data-formacion="${f.id}" style="padding:6px 12px;font-size:13px;min-width:unset">${f.label}</button>`).join('')}
      </div>
      ${sinArquero ? '<p class="aviso">No tenés ningún arquero disponible. El arco solo lo puede ocupar un POR: conseguí uno antes de empezar.</p>' : ''}
      ${!sinArquero && vacios.length ? `<p class="aviso">Quedan ${vacios.length} puesto(s) sin cubrir. Tocá el puesto vacío para elegir jugador.</p>` : ''}
      <div class="cancha-grid">${lineas.map((l) => `<div class="linea-f">${l.map(slot).join('')}</div>`).join('')}</div>
      ${banco.length ? `<div class="bench-section">
        <div class="eyebrow">Suplentes (${banco.length})</div>
        <div class="bench-row">${banco.map((x, i) => carta(x, { draggable: true, i })).join('')}</div>
      </div>` : ''}
      <p class="hint">${slotElegido
        ? `Elegí quién juega de <b>${slotElegido}</b>. Cada carta muestra su rating real y el que rinde en este puesto: <span class="pen-vecino-tx">ámbar −${FUERZA.PENALIDAD_POSICION.VECINO}</span> si es una línea vecina, <span class="pen-fuera-tx">rojo −${FUERZA.PENALIDAD_POSICION.FUERA}</span> si está fuera de posición.`
        : 'Arrastrá un jugador sobre otro para intercambiarlos, o tocar un puesto para cambiarlo.'}</p>
      ${slotElegido ? `<div class="grid-cartas">${candidatos.map((x, i) => carta(x, { accion: 'poner', slot: slotElegido, i })).join('')}</div>` : ''}
      <div class="row">
        <button class="btn" data-accion="confirmar-once">${c.temporada === 1 ? 'Empezar la temporada' : 'Confirmar y seguir'}</button>
        <button class="btn ghost" data-accion="auto-once">Armado automático</button>
      </div>
    </div>`;
  },

  previa: () => {
    const desde = c.partidosTemporada.length + 1;
    const pos = c.liga ? miPosicion(c.liga) : 20;
    const obj = c.objetivo;
    const enPeligro = pos > obj;
    const chip = `<div class="chip-objetivo ${enPeligro ? 'peligro' : 'ok'}">
      🎯 Objetivo: Top ${obj} · Posición actual: ${pos}°${enPeligro ? ' ⚠️' : ' ✓'}</div>`;
    return `<div class="stack${tsEntra ? ' ts-anim' : ''}">
      ${marcador()}
      ${chip}
      <div class="panel stack ts-tramo">
        <div class="ts-tramo-tag"><i></i>Tramo ${c.tramo + 1} de ${LIGA.TRAMOS.length}</div>
        <h2>Fechas <span class="ts-glow">${desde} a ${desde + LIGA.TRAMOS[c.tramo] - 1}</span></h2>
        <p class="hint">Se juegan ${LIGA.TRAMOS[c.tramo]} partidos de corrido. Después vas a tener que tomar una decisión.</p>
        <div class="row">
          <button class="btn ts-cta" data-accion="jugar">Simular rápido</button>
          <button class="btn ghost" data-accion="jugar-visual">▶ Ver partido</button>
          <button class="btn ghost" data-accion="ir-once">Cambiar el 11 · ${c.formacion || '4-3-3'}</button>
        </div>
      </div>
      ${tablaPosiciones()}
      ${tablaGoleadores()}
    </div>`;
  },

  resultados: () => {
    const t = c.ultimoTramo;
    return `<div class="stack${tsEntra ? ' ts-anim' : ''}">
      ${marcador()}
      <div class="panel stack">
        <div class="eyebrow">Resultados del tramo · ${t.pts} de ${t.partidos.length * 3} puntos</div>
        <div>${t.partidos.map((p) => `<div class="partido">
          <span class="eq">${escudoRival(p.rival)}<span>${esc(p.rival)} <span class="muted">(${p.localia})</span></span></span>
          <span class="res-fila"><span class="res ${p.res}">${p.res}</span><span class="num">${p.gf}-${p.gc}</span></span>
        </div>`).join('')}</div>
        <div class="row"><button class="btn" data-accion="ir-evento">Seguir</button></div>
      </div>
      ${tablaPosiciones()}
      ${tablaGoleadores()}
    </div>`;
  },

  evento: () => {
    if (ui.cargando) {
      return `<div class="stack${tsEntra ? ' ts-anim' : ''}">${marcador()}
        <div class="panel evento stack"><div class="eyebrow">Punto de decisión</div>
        <h2 style="opacity:.4">Pasa algo en el club…</h2><p class="hint">Un segundo.</p></div></div>`;
    }
    const n = c.eventoActual.narracion;
    const p = paquete(n.paqueteId);

    // Evento grave: notificación forzada sin elección A/B
    if (p.grave) {
      const opcionCat = p.opciones[0];
      return `<div class="stack${tsEntra ? ' ts-anim' : ''}">
        ${marcador()}
        <div class="panel evento stack" style="border-color:rgba(255,91,30,.35)">
          <div class="eyebrow" style="color:#ff5b1e">⚠️ Notificación — Temporada ${c.temporada}</div>
          <h2>${esc(n.titulo)}</h2>
          <p>${esc(n.texto)}</p>
          ${leyendaVars()}
          <div class="consecuencias">${resultadoBloque(opcionCat.efectos, null, false)}</div>
          <button class="btn" data-accion="elegir" data-op="continuar">Continuar</button>
        </div>
      </div>`;
    }

    return `<div class="stack${tsEntra ? ' ts-anim' : ''}">
      ${marcador()}
      <div class="panel evento stack">
        <div class="eyebrow">Temporada ${c.temporada} · Decisión ${c.tramo + 1}</div>
        <h2>${esc(n.titulo)}</h2>
        <p>${esc(n.texto)}</p>
        ${leyendaVars()}
        <div class="stack">
          ${n.opciones.map((o) => {
            const opcionCat = p.opciones.find((x) => x.id === o.id);
            const variable = !!opcionCat.resultado;
            const maxProb = variable ? Math.max(...opcionCat.resultado.map(r => r.prob)) : null;
            const abierto = ui.detalleAbierto.has(o.id);
            const detalle = variable
              ? `<div class="consecuencias">${splitBar(opcionCat.resultado)}${opcionCat.resultado.map((r) => resultadoBloque(r.efectos, r.prob, r.prob === maxProb)).join('')}</div>`
              : `<div class="consecuencias">${resultadoBloque(opcionCat.efectos, null, false)}</div>`;
            return `<div class="opcion-card">
              <button class="opcion-main" data-accion="elegir" data-op="${o.id}">
                <div class="opcion-top">
                  <span class="opcion-label">${esc(o.label)}</span>
                  ${variable ? `<span class="riesgo-tag">🎲 resultado incierto</span>` : `<span class="riesgo-tag directo">✓ resultado directo</span>`}
                </div>
                <div class="expected-chips">${chipsEsperados(opcionCat)}</div>
              </button>
              ${variable ? `<button class="opcion-toggle" data-accion="toggle-detalle" data-op="${o.id}">${abierto ? 'Ocultar el detalle de probabilidades ▲' : `Ver los ${opcionCat.resultado.length} resultados posibles y sus chances ▾`}</button>` : ''}
              ${variable && abierto ? detalle : ''}
            </div>`;
          }).join('')}
        </div>
        <div class="hint">Los íconos de cada opción son el promedio esperado, ponderado por probabilidad. Tocá "ver resultados posibles" para el detalle exacto de cada chance.</div>
      </div>
    </div>`;
  },

  lesion: () => {
    const porId = new Map(c.plantel.map((x) => [x.id, x]));
    const lesionado = porId.get(c.lesionadoId);
    const onceSet = new Set(c.once);
    const suplentes = c.plantel.filter((j) => !onceSet.has(j.id));
    return `<div class="stack${tsEntra ? ' ts-anim' : ''}">
      ${marcador()}
      <div class="panel stack" style="border-color:rgba(255,91,30,.35)">
        <div class="eyebrow" style="color:#ff5b1e">⚠️ Baja obligatoria — Temporada ${c.temporada}</div>
        <h2>🚑 Lesión de 3 semanas</h2>
        ${lesionado ? `<p><strong>${esc(lesionado.nombre)}</strong> (${esc(lesionado.pos)} · ${lesionado.rating}) estará fuera el próximo tramo.</p>` : ''}
        ${suplentes.length === 0
          ? `<p class="hint">No hay suplentes disponibles. El equipo juega con el plantel corto.</p>
             <p style="color:#ff5b1e">−2 ratingDelta automático.</p>
             <button class="btn" data-accion="elegir-reemplazo" data-id="">Continuar</button>`
          : `<p class="hint">Elegí quién entra al once en su lugar:</p>
             <div class="stack">${suplentes.map((j) => `
               <button class="opcion-main" data-accion="elegir-reemplazo" data-id="${j.id}">
                 <span>${esc(j.nombre)}</span>
                 <span class="muted">${esc(j.pos)} · ${j.rating}</span>
               </button>`).join('')}
             </div>`}
      </div>
    </div>`;
  },

  resumen: () => {
    const t = c.ultimaTemporada;
    return `<div class="stack${tsEntra ? ' ts-anim' : ''}">
      ${marcador()}
      <div class="panel stack">
        <div class="eyebrow">Fin de la temporada ${t.temporada}</div>
        <h2>${t.campeon ? '¡Campeón!' : t.cumplio ? `${t.posicion}° — objetivo cumplido` : `${t.posicion}° — objetivo incumplido`}</h2>
        <p class="hint">${t.pts} puntos · ${t.g}G ${t.e}E ${t.p}P · ${t.gf}:${t.gc} · el club pedía terminar ${t.objetivo}° o mejor.</p>
        <table><tbody>${t.tablaTop5.map((x, i) => `<tr class="${x.nombre === c.club ? 'mio' : ''}"><td class="n">${i + 1}</td><td class="eq">${escudoClub(x.nombre)}<span>${esc(x.nombre)}</span></td><td class="n">${x.pts}</td></tr>`).join('')}</tbody></table>
        ${tablaGoleadores(t.estadisticas)}
        <div class="row"><button class="btn" data-accion="abrir-refuerzo">Abrir el sobre de refuerzo</button></div>
      </div>
    </div>`;
  },

  ofertas: () => {
    const ofertas = c.jugadoresConOferta || [];
    return `<div class="stack${tsEntra ? ' ts-anim' : ''}">
      ${marcador()}
      <div class="panel stack">
        <div class="eyebrow">Mercado de pases — entre temporadas</div>
        <h2>Ofertas del exterior</h2>
        <p class="hint">Estos jugadores recibieron propuestas. Decidí si los vendés o los retenés.</p>
        ${ofertas.map(j => `
          <div class="panel stack" style="gap:0.5rem">
            <div style="display:flex;align-items:center;gap:0.75rem">
              ${carta(j, {})}
              <div class="stack" style="gap:0.25rem;flex:1">
                <div><strong>${esc(j.nombre)}</strong> · ${j.pos} · OVR ${j.rating} · ${j.edad} años</div>
                <div class="hint">Oferta: <strong>${fmtMoney(j.moneyOferta)}</strong> + 1 carta de refuerzo extra</div>
              </div>
            </div>
            <div class="row">
              <button class="btn btn-secondary" data-accion="rechazar-oferta" data-id="${j.id}">Rechazar — moral del plantel +5</button>
              <button class="btn" data-accion="vender-oferta" data-id="${j.id}">Vender — +${fmtMoney(j.moneyOferta)}</button>
            </div>
          </div>`).join('')}
        <div class="sep"></div>
        <div class="row"><button class="btn btn-secondary" data-accion="confirmar-ofertas">Continuar al sobre de refuerzo</button></div>
      </div>
    </div>`;
  },

  refuerzo: () => {
    const entran = c.refuerzo.filter((x) => ui.sel.has(x.id));
    const exceso = Math.max(0, c.plantel.length + entran.length - CARRERA.PLANTEL_MAX);
    const faltan = Math.max(0, exceso - ui.salen.size);
    const ingreso = c.plantel.filter((x) => ui.salen.has(x.id)).reduce((s, x) => s + valorDeVenta(x), 0);
    return `<div class="stack${tsEntra ? ' ts-anim' : ''}">
      ${marcador()}
      <div class="panel stack">
        <div class="eyebrow">Sobre de refuerzo · terminaste ${c.ultimaTemporada.posicion}°</div>
        <h2>Refuerzos para la temporada ${c.temporada + 1}</h2>
        <p class="hint">Cuanto mejor terminaste, mejores son las cartas. Elegí a quiénes sumás.</p>
        <div class="grid-cartas">${c.refuerzo.map((x, i) => carta(x, { sel: ui.sel.has(x.id), accion: 'sel-refuerzo', i })).join('')}</div>
        ${exceso ? `<div class="sep"></div>
          <div class="eyebrow">Plantel lleno (${CARRERA.PLANTEL_MAX}) — vendé ${exceso} ${exceso === 1 ? 'jugador' : 'jugadores'} ${ingreso ? `· entran ${fmtMoney(ingreso)}` : ''}</div>
          <div class="grid-cartas">${[...c.plantel].sort((a, b) => a.rating - b.rating).map((x, i) => carta(x, { sel: ui.salen.has(x.id), accion: 'sel-venta', i })).join('')}</div>` : ''}
        <div class="row">
          <button class="btn" data-accion="confirmar-refuerzo" ${faltan ? 'disabled' : ''}>${faltan ? `Faltan ${faltan} salidas` : 'Confirmar plantel'}</button>
        </div>
      </div>
    </div>`;
  },

  fin: () => {
    const r = resumenCarrera(c);
    const despedido = r.motivoFin === 'despedido';
    return `<div class="stack" style="padding-top:6vh">
      <div class="eyebrow">${despedido ? 'Te echaron' : 'Contrato cumplido'}</div>
      <h1>${despedido ? `${r.temporadasJugadas} temporadas` : 'Ocho temporadas'}</h1>
      <div class="panel stack">
        <p>${despedido
          ? `La presión llegó a 100 en la temporada ${c.temporada}. La comisión te agradeció los servicios prestados.`
          : `Aguantaste las ocho temporadas en ${esc(c.club)}. Pocos DT llegan hasta acá.`}</p>
        <div class="sep"></div>
        <div class="row" style="gap:32px">
          <div><div class="eyebrow">Títulos</div><div class="display" style="font-size:40px;color:var(--fluor)">${r.titulos}</div></div>
          <div><div class="eyebrow">Mejor puesto</div><div class="display" style="font-size:40px">${r.mejorPosicion ?? '—'}°</div></div>
          <div><div class="eyebrow">Promedio</div><div class="display" style="font-size:40px">${r.posicionPromedio ?? '—'}°</div></div>
        </div>
        <div class="sep"></div>
        <table><thead><tr><th>T</th><th>Puesto</th><th>Objetivo</th><th class="n">Pts</th></tr></thead>
          <tbody>${c.temporadas.map((t) => `<tr class="${t.campeon ? 'mio' : ''}"><td class="n">${t.temporada}</td><td>${t.posicion}°</td><td class="muted">${t.objetivo}° ${t.cumplio ? '✔' : '✘'}</td><td class="n">${t.pts}</td></tr>`).join('')}</tbody></table>
        <div class="row"><button class="btn" data-accion="reiniciar">Empezar otra carrera</button></div>
      </div>
    </div>`;
  },

  'draft-puro': () => {
    const dp = ui.draftPuro;
    if (!dp) return '<div class="stack"><p class="hint">Cargando draft…</p></div>';
    const total = dp.grupos.length;
    const pick = dp.pick;
    const opciones = dp.grupos[pick] || [];
    const posIcono = { POR: '🧤', DEF: '🛡️', MED: '⚙️', DEL: '⚡' };
    return `<div class="stack">
      <div class="eyebrow">Modo Draft · Carta ${pick + 1} de ${total}</div>
      <h2>Elegí tu carta</h2>
      <p class="hint">Quedan ${total - pick} elecciones. Cada carta que elegís va directo a tu plantel.</p>
      <div class="grid-cartas" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr))">
        ${opciones.map((x, i) => `
          <div data-accion="draft-elegir" data-i="${i}" style="cursor:pointer;transition:transform .15s" onmouseenter="this.style.transform='translateY(-4px)'" onmouseleave="this.style.transform=''">
            ${carta(x, { i })}
          </div>`).join('')}
      </div>
      ${dp.elegidas.length > 0 ? `
        <div class="sep"></div>
        <div class="eyebrow">Ya elegidas (${dp.elegidas.length})</div>
        <div class="grid-cartas" style="opacity:.7">${dp.elegidas.map((x) => carta(x)).join('')}</div>
      ` : ''}
    </div>`;
  },
};

function renderBotonNuevaPartida() {
  let host = document.getElementById('fab-nueva');
  if (ui.vista === 'onboarding' || ui.vista === 'guia') {
    if (host) host.remove();
    return;
  }
  if (!host) {
    host = document.createElement('button');
    host.id = 'fab-nueva';
    host.dataset.accion = 'nueva-partida';
    host.title = 'Empezar una nueva partida';
    host.style.cssText = 'position:fixed;top:14px;right:14px;z-index:9999;padding:8px 14px;border-radius:4px;background:var(--panel);color:var(--tiza);font-family:"Barlow Condensed",sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.09em;font-size:13px;box-shadow:inset 0 0 0 1px var(--linea);cursor:pointer;';
    host.textContent = '↺ Nueva partida';
    document.body.appendChild(host);
    host.addEventListener('click', () => { acciones['nueva-partida'](); render(); });
  }
}

function render() {
  const cambioVista = tsVistaAnterior !== ui.vista;
  tsEntra = cambioVista;
  tsVistaAnterior = ui.vista;
  app.innerHTML = PANTALLAS[ui.vista]();
  // Botón flotante siempre visible: permite abandonar la carrera en cualquier
  // momento y volver a onboarding. Oculto en la propia pantalla de onboarding
  // (no hay a dónde volver) y durante los sobres iniciales de la carrera nueva.
  renderBotonNuevaPartida();
  // Solo las pantallas arrancan arriba de todo. Una interacción que re-renderiza
  // la MISMA vista (dropdown de onboarding, elegir jugador en el once, toggle de
  // tabla, abrir sobre) conserva el scroll — si no, cada click salta al tope.
  if (cambioVista) window.scrollTo({ top: 0, behavior: 'instant' });
  setTimeout(() => { ui.deltas = null; }, 1800);
}

// ───────────────────────── acciones ─────────────────────────
const _guardarDtDraft = () => {
  const ob = ui.onboarding;
  localStorage.setItem('dt_draft', JSON.stringify({ nombre: ob.nombre, pais: ob.pais, liga: ob.liga, clubId: ob.clubId, modo: ob.modo, modoJuego: ob.modoJuego, formacion: ob.formacion }));
};
const acciones = {
  'ob-modo'(el) { ui.onboarding.modo = el.dataset.modo; render(); _guardarDtDraft(); },
  'ob-formacion'(el) { ui.onboarding.formacion = el.dataset.id; render(); _guardarDtDraft(); },
  'ob-pais'(el) {
    const ob = ui.onboarding;
    ob.nombre = document.getElementById('ob-dt')?.value ?? ob.nombre;
    if (el.dataset.pais) { ob.pais = el.dataset.pais; ob.abierto = null; }
    else ob.abierto = ob.abierto === 'pais' ? null : 'pais';
    _guardarDtDraft();
  },
  'ob-club'(el) {
    const ob = ui.onboarding;
    ob.nombre = document.getElementById('ob-dt')?.value ?? ob.nombre;
    if (el.dataset.id) { ob.clubId = el.dataset.id; ob.abierto = null; }
    else if (!ob.cargando) ob.abierto = ob.abierto === 'club' ? null : 'club';
    _guardarDtDraft();
  },
  async 'ob-liga'(el) {
    const ob = ui.onboarding;
    // Guardamos lo ya tipeado: el cambio de liga dispara un render() antes de
    // terminar, y el innerHTML se reconstruye — sin esto se perdería lo escrito.
    ob.nombre = document.getElementById('ob-dt')?.value ?? ob.nombre;
    // El país ya vive en el estado (dropdown visual), no en un input.
    ob.liga = el.dataset.liga;
    ob.abierto = null;
    ob.cargando = true; ob.error = null; ob.clubes = []; ob.clubId = '';
    _guardarDtDraft();
    render();
    // Los clubes viven en leagues.js (la misma fuente que el draft y el motor):
    // así el club elegido siempre tiene cartas en su liga, un id estable para
    // persistir en `managers` y un escudo resoluble por la teca local.
    const { getLeagueById } = await import('../data/leagues.js');
    const liga = getLeagueById(ob.liga);
    const clubes = liga ? liga.clubs.map((c) => ({ ...c })) : [];
    clubes.forEach((cl) => {
      const teca = escudoDeNombre(cl.name);
      if (teca) { const img = new Image(); img.src = teca; }
    });
    ob.cargando = false;
    ob.clubes = clubes;
    ob.clubId = clubes[0]?.id || '';
    ob.error = clubes.length === 0 ? 'No hay clubes cargados para esta liga todavía.' : null;
  },
  async 'ob-confirmar'() {
    const ob = ui.onboarding;
    ob.nombre = document.getElementById('ob-dt').value.trim();
    // País y club ya viven en el estado (dropdowns visuales, no <select>/<input>).
    ob.abierto = null;
    if (!ob.nombre || !ob.pais || !ob.liga || !ob.clubId) {
      ob.error = 'Completá tu nombre, país, liga y club antes de firmar.';
      return;
    }
    ob.enviando = true; ob.error = null; render();
    const { crearManager } = await import('../net/supabaseClient.js');
    const managerId = await crearManager({ name: ob.nombre, country: ob.pais, league_id: ob.liga, club_id: ob.clubId, modo: ob.modo || 'facil', modo_juego: ob.modoJuego || 'liga' });
    if (!managerId) {
      ob.enviando = false;
      ob.error = 'No se pudo crear el perfil. Intentá de nuevo.';
      return;
    }
    localStorage.setItem('manager_id', managerId);
    const club = ob.clubes.find((cl) => cl.id === ob.clubId);

    // Draft inicial real: 3 sobres x 5 cartas de la liga elegida
    // (openInitialPacks guarda el plantel en user_cards y devuelve los sobres
    // armados). Si la DB falla, el motor arma los sobres locales — la carrera
    // nunca se traba y el mock queda solo como fallback offline.
    const modoJuego = ob.modoJuego || 'liga';
    // Determinar el pool de cartas según el modo de juego
    const nationalityId = modoJuego === 'pais' ? (PAIS_A_NACION_ID.get(ob.pais) ?? null) : null;
    const leagueIdPool =
      modoJuego === 'global' ? null
      : modoJuego === 'pais'  ? null  // filtro por nationalityId, no por liga
      : ob.liga; // liga, budget, draft
    // Cap de OVR: en modo Global el pool es de todo el catálogo; limitamos el
    // techo de rating según la liga del DT para no romper el balance competitivo.
    const { OVR_CAP_POR_LIGA, OVR_CAP_DEFAULT } = await import('../engine/balance.js');
    const ovrCap = modoJuego === 'global'
      ? (OVR_CAP_POR_LIGA[ob.liga] ?? OVR_CAP_DEFAULT)
      : 99;

    ui.miEscudo = club?.badge_url || club?.club_badge_url || club?.badge || '';

    if (modoJuego === 'club_real') {
      let resultado = null;
      try {
        const { openClubRealSquad } = await import('../data/cardsRepo.js');
        resultado = await openClubRealSquad(managerId, club?.name, ob.liga);
      } catch (e) {
        console.warn('[dream-team] openClubRealSquad falló, fallback a sobres estándar:', e.message);
      }
      c = iniciarCarrera({
        dt: ob.nombre,
        club: club?.name || ob.nombre,
        leagueId: ob.liga,
        clubId: club?.id,
        plantelBase: resultado?.plantelNormalizado || null,
        cartasInicialesDB: resultado?.sobreDB || null,
        modo: ob.modo || 'facil',
        modoJuego,
        formacion: ob.formacion || '4-3-3',
      });
      ob.enviando = false;
      localStorage.removeItem('dt_draft');
      ui.vista = 'sobres'; ui.sobresAbiertos = [];
      return;
    }

    if (modoJuego === 'draft') {
      // Draft Puro: abrimos el pool pero NO guardamos en user_cards todavía
      let grupos = [];
      try {
        const { openDraftPool } = await import('../data/cardsRepo.js');
        grupos = await openDraftPool(managerId, leagueIdPool, 15, 4, nationalityId);
      } catch (e) {
        console.warn('[dream-team] openDraftPool falló:', e.message);
      }
      ob.enviando = false;
      ui.draftPuro = {
        grupos, pick: 0, elegidas: [],
        managerId, dt: ob.nombre,
        club: club?.name || ob.nombre,
        leagueId: ob.liga, clubId: club?.id,
        modo: ob.modo || 'facil',
      };
      ui.vista = 'draft-puro';
      return;
    }

    let sobresInicialesDB = null;
    try {
      const { openInitialPacks } = await import('../data/cardsRepo.js');
      sobresInicialesDB = await openInitialPacks(managerId, leagueIdPool, nationalityId, ovrCap);
    } catch (e) {
      console.warn('[dream-team] Draft inicial de Supabase falló, se usa el fallback local:', e.message);
    }

    c = iniciarCarrera({
      dt: ob.nombre,
      club: club?.name || ob.nombre,
      leagueId: ob.liga,
      clubId: club?.id,
      cartasInicialesDB: sobresInicialesDB,
      modo: ob.modo || 'facil',
      modoJuego,
      formacion: ob.formacion || '4-3-3',
    });
    ob.enviando = false;
    localStorage.removeItem('dt_draft');
    ui.vista = 'sobres'; ui.sobresAbiertos = [];
  },
  async empezar() {
    const dt = document.getElementById('dt').value.trim() || 'DT';
    const club = CLUBES_JUGABLES[Number(document.getElementById('club').value)];
    // Capa exterior: pedimos los 3 sobres iniciales a Supabase en paralelo.
    // Si falla (devuelve null), el motor genera los sobres locales síncronos —
    // la carrera nunca se traba. Todo-o-nada: no se mezclan IDs locales con DB.
    // Import dinámico: el cliente Supabase no se carga al arrancar el juego.
    const { fetchAbrirSobre } = await import('../net/supabaseClient.js');
    const sobres = await Promise.all([
      fetchAbrirSobre(), fetchAbrirSobre(), fetchAbrirSobre(),
    ]);
    const cartasInicialesDB = sobres.every(Boolean) ? sobres : null;
    c = iniciarCarrera({ dt, club: club.nombre, cartasInicialesDB });
    ui.vista = 'sobres'; ui.sobresAbiertos = [];
  },
  'ob-set-modo'(el) { ui.onboarding.modoJuego = el.dataset.modo; _guardarDtDraft(); },
  'volver-onboarding'() { ui.vista = 'onboarding'; render(); },
  'abrir-sobre'(el) { ui.sobresAbiertos.push(Number(el.dataset.i)); },
  'ir-once'() {
    ui.vista = 'once'; ui.slot = null;
    const slots = FORMACIONES_SLOTS[c.formacion] || FORMACION;
    const plantelIds = new Set(c.plantel.map((x) => x.id));
    const onceValido = c.once.length === slots.length && c.once.every((id) => id && plantelIds.has(id));
    if (!onceValido) c.once = autoOnce(c.plantel, { formacion: slots });
  },
  async 'draft-elegir'(el) {
    const dp = ui.draftPuro;
    if (!dp) return;
    const i = Number(el.dataset.i);
    const elegida = dp.grupos[dp.pick][i];
    dp.elegidas.push(elegida);
    dp.pick++;
    if (dp.pick >= dp.grupos.length) {
      ui.cargando = true; render();
      try {
        const { saveDraftChoices } = await import('../data/cardsRepo.js');
        await saveDraftChoices(dp.managerId, dp.elegidas.map((x) => x.id));
      } catch (e) {
        console.warn('[dream-team] saveDraftChoices falló:', e.message);
      }
      const sobres = [dp.elegidas.slice(0, 5), dp.elegidas.slice(5, 10), dp.elegidas.slice(10, 15)];
      c = iniciarCarrera({
        dt: dp.dt, club: dp.club, leagueId: dp.leagueId, clubId: dp.clubId,
        cartasInicialesDB: sobres, modo: dp.modo, modoJuego: 'draft',
      });
      ui.cargando = false;
      ui.draftPuro = null;
      ui.vista = 'once'; ui.slot = null;
      const _slots = FORMACIONES_SLOTS[c.formacion] || FORMACION;
      const _ids = new Set(c.plantel.map((x) => x.id));
      if (!(c.once.length === _slots.length && c.once.every((id) => id && _ids.has(id)))) c.once = autoOnce(c.plantel, { formacion: _slots });
    }
  },
  slot(el) { const i = Number(el.dataset.i); ui.slot = ui.slot === i ? null : i; },
  poner(el) {
    if (ui.slot === null) return;
    const id = el.dataset.id;
    const actual = c.once[ui.slot];
    const donde = c.once.indexOf(id);
    if (donde === ui.slot) { ui.slot = null; return; }   // ya estaba en ese puesto
    if (donde >= 0) c.once[donde] = actual;              // swap: la que estaba baja al puesto de la otra
    c.once[ui.slot] = id;
    ui.slot = null;
  },
    'cambiar-formacion'(el) {
    const f = el.dataset.formacion;
    if (!f || f === c.formacion) return;
    c.formacion = f;
    c.once = autoOnce(c.plantel, { formacion: FORMACIONES_SLOTS[f] || FORMACION });
    ui.slot = null;
  },
  'auto-once'() { c.once = autoOnce(c.plantel, { formacion: FORMACIONES_SLOTS[c.formacion] || FORMACION }); ui.slot = null; },
  'confirmar-once'() { confirmarOnce(c, c.once); ui.vista = 'previa'; },
  jugar() {
    jugarTramo(c);
    ui.deltas = c.ultimoTramo?.deltas || null;
    ui.vista = c.fase === FASES.FIN ? 'fin' : 'resultados';
  },
  async 'jugar-visual'() {
    jugarTramo(c);
    ui.deltas = c.ultimoTramo?.deltas || null;
    render();
    await mostrarSimulacionVisual();
    ui.vista = c.fase === FASES.FIN ? 'fin' : 'resultados';
  },
  async 'ir-evento'() {
    ui.vista = 'evento'; ui.cargando = true; ui.detalleAbierto = new Set(); render();
    const candidatos = candidatosDelTramo(c);
    // Evento grave: narración ya fijada por el motor, sin llamada a IA
    if (!c.eventoActual.narracion) {
      const narracion = await pedirNarracion(candidatos, contexto(c));
      fijarNarracion(c, narracion); // si es null, el motor sortea y usa el catálogo
    }
    ui.fuenteIA = c.eventoActual.narracion.fuente;
    ui.cargando = false;
  },
  'toggle-detalle'(el) {
    const id = el.dataset.op;
    ui.detalleAbierto.has(id) ? ui.detalleAbierto.delete(id) : ui.detalleAbierto.add(id);
  },
  elegir(el) {
    const { deltas } = resolverEvento(c, el.dataset.op);
    ui.deltas = deltas;
    ui.vista = c.fase === FASES.FIN ? 'fin' : c.fase === FASES.LESION ? 'lesion' : c.fase === FASES.RESUMEN ? 'resumen' : 'previa';
  },
  async 'abrir-refuerzo'() {
    calcularOfertasPlantel(c);
    if (c.jugadoresConOferta?.length) {
      ui.vista = 'ofertas';
      return;
    }
    await ACCIONES['confirmar-ofertas']();
  },
  'vender-oferta'(el) {
    resolverOferta(c, el.dataset.id, true);
    if (!c.jugadoresConOferta?.length) return; // quedan más — re-render automático
  },
  'rechazar-oferta'(el) {
    resolverOferta(c, el.dataset.id, false);
  },
  async 'confirmar-ofertas'() {
    // Capa exterior: pedimos el sobre a Supabase. Si falla (devuelve null),
    // el motor genera el sobre local síncrono — la carrera nunca se traba.
    const { fetchAbrirSobre } = await import('../net/supabaseClient.js');
    const managerId = localStorage.getItem('manager_id');
    const cartasDB = managerId
      ? await fetchAbrirSobre({ managerId, packId: PACK_ID, free: false })
      : null;
    if (cartasDB) registrarRefuerzo(c, cartasDB);
    else abrirRefuerzo(c);
    if (c.sobreExtraRotacion > 0) {
      const extra = cartasExtraRefuerzo(c, c.sobreExtraRotacion);
      c.refuerzo = [...(c.refuerzo || []), ...extra];
      c.sobreExtraRotacion = 0;
    }
    ui.sel = new Set(); ui.salen = new Set(); ui.vista = 'refuerzo';
  },
  'sel-refuerzo'(el) { const id = el.dataset.id; ui.sel.has(id) ? ui.sel.delete(id) : ui.sel.add(id); },
  'sel-venta'(el) { const id = el.dataset.id; ui.salen.has(id) ? ui.salen.delete(id) : ui.salen.add(id); },
  'confirmar-refuerzo'() {
    aplicarRefuerzo(c, [...ui.sel], [...ui.salen]);
    ui.vista = 'once'; ui.slot = null;
  },
  'elegir-reemplazo'(el) {
    const { deltas } = elegirReemplazoLesion(c, el.dataset.id || null);
    ui.deltas = deltas;
    ui.vista = 'previa';
  },
  tabla() { ui.tabla = !ui.tabla; },
  reiniciar() {
    c = null;
    ui = { ...ui, vista: 'onboarding', tabla: false, sobresAbiertos: [] };
    ui.onboarding.abierto = null;
  },
  'nueva-partida'() {
    if (!confirm('¿Empezar una nueva partida? Se pierde la carrera actual.')) return;
    localStorage.removeItem('manager_id');
    localStorage.removeItem('dt_draft');
    c = null;
    ui = { ...ui, vista: 'onboarding', tabla: false, sobresAbiertos: [], draftPuro: null };
    ui.onboarding = { liga: null, clubes: [], clubId: '', nombre: '', pais: '', cargando: false, error: null, enviando: false, abierto: null, modo: 'facil', modoJuego: 'liga', formacion: '4-3-3' };
  },
  'ver-guia'() { ui.vistaAnterior = ui.vista; ui.vista = 'guia'; },
  volver() { ui.vista = ui.vistaAnterior || 'intro'; },
};

app.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-accion]');
  if (!el) return;
  const fn = acciones[el.dataset.accion];
  if (!fn) return;
  const r = fn(el);
  if (r instanceof Promise) await r;
  render();
});

// ───────────────────────── drag & drop (once) ─────────────────────────
function executeDragSwap(srcType, srcId, srcSlotIdx, dstType, dstId, dstSlotIdx) {
  if (!c || ui.vista !== 'once') return;
  if (srcId === dstId) return;
  if (srcType === 'slot' && dstType === 'slot') {
    const si = Number(srcSlotIdx), di = Number(dstSlotIdx);
    if (isNaN(si) || isNaN(di) || si === di) return;
    const tmp = c.once[si]; c.once[si] = c.once[di]; c.once[di] = tmp;
  } else if (srcType === 'slot' && dstType === 'bench') {
    const si = Number(srcSlotIdx);
    if (isNaN(si)) return;
    c.once[si] = dstId;
  } else if (srcType === 'bench' && dstType === 'slot') {
    const di = Number(dstSlotIdx);
    if (isNaN(di)) return;
    c.once[di] = srcId;
  }
  ui.slot = null;
}
function clearDragVisuals() {
  document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
  document.querySelectorAll('.dragging').forEach((el) => el.classList.remove('dragging'));
  if (dragState.ghost) { dragState.ghost.remove(); dragState.ghost = null; }
  dragState.active = false; dragState.playerId = null; dragState.sourceType = null;
  dragState.sourceSlotIdx = null; dragState.moved = false; dragState._srcEl = null;
}
// Desktop: HTML5 Drag & Drop
app.addEventListener('dragstart', (e) => {
  if (ui.vista !== 'once') return;
  const src = e.target.closest('.slot[data-player-id], .card[data-player-id]');
  if (!src) return;
  dragState.active = true; dragState.playerId = src.dataset.playerId;
  dragState.sourceType = src.dataset.dropType;
  dragState.sourceSlotIdx = src.dataset.slotIndex ?? null;
  src.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragState.playerId);
  const blank = document.createElement('canvas'); blank.width = 1; blank.height = 1;
  e.dataTransfer.setDragImage(blank, 0, 0);
});
app.addEventListener('dragover', (e) => {
  if (!dragState.active) return;
  const t = e.target.closest('.slot[data-drop-type], .card[data-player-id]');
  if (!t || t.dataset.playerId === dragState.playerId) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
  t.classList.add('drag-over');
});
app.addEventListener('drop', (e) => {
  e.preventDefault(); if (!dragState.active) return;
  const t = e.target.closest('.slot[data-drop-type], .card[data-player-id]');
  if (!t || t.dataset.playerId === dragState.playerId) { clearDragVisuals(); return; }
  executeDragSwap(dragState.sourceType, dragState.playerId, dragState.sourceSlotIdx,
    t.dataset.dropType, t.dataset.playerId, t.dataset.slotIndex ?? null);
  clearDragVisuals(); render();
});
app.addEventListener('dragend', () => { clearDragVisuals(); });

// Mobile: touch drag con long-press + clone flotante
let _touchTimer = null;
app.addEventListener('touchstart', (e) => {
  if (ui.vista !== 'once') return;
  const src = e.target.closest('.slot[data-player-id], .card[data-player-id]');
  if (!src) return;
  const touch = e.touches[0];
  dragState.startX = touch.clientX; dragState.startY = touch.clientY;
  dragState.playerId = src.dataset.playerId;
  dragState.sourceType = src.dataset.dropType;
  dragState.sourceSlotIdx = src.dataset.slotIndex ?? null;
  dragState._srcEl = src; dragState.moved = false;
  // Long-press de 300ms para iniciar drag (no confunde con scroll ni tap)
  _touchTimer = setTimeout(() => {
    if (!dragState._srcEl) return;
    dragState.active = true;
    const img = src.querySelector('img');
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.innerHTML = `<img src="${img ? img.src : ''}" alt="">`;
    document.body.appendChild(ghost);
    dragState.ghost = ghost;
    src.classList.add('dragging');
    // Haptic feedback si disponible
    if (navigator.vibrate) navigator.vibrate(30);
  }, 300);
}, { passive: true });

app.addEventListener('touchmove', (e) => {
  if (!dragState.active) {
    // Si el usuario se mueve antes del long-press, cancelar
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - dragState.startX);
    const dy = Math.abs(touch.clientY - dragState.startY);
    if (dx > 10 || dy > 10) { clearTimeout(_touchTimer); dragState._srcEl = null; }
    return;
  }
  e.preventDefault();
  const touch = e.touches[0];
  if (dragState.ghost) {
    dragState.ghost.style.left = touch.clientX + 'px';
    dragState.ghost.style.top = touch.clientY + 'px';
  }
  // Hit-test: qué elemento está debajo del dedo
  if (dragState.ghost) dragState.ghost.style.display = 'none';
  const under = document.elementFromPoint(touch.clientX, touch.clientY);
  if (dragState.ghost) dragState.ghost.style.display = '';
  document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
  if (under) {
    const t = under.closest('.slot[data-drop-type], .card[data-player-id]');
    if (t && t.dataset.playerId !== dragState.playerId) t.classList.add('drag-over');
  }
}, { passive: false });

app.addEventListener('touchend', (e) => {
  clearTimeout(_touchTimer);
  if (!dragState.active || !dragState.ghost) {
    clearDragVisuals(); dragState.active = false; dragState._srcEl = null; return;
  }
  const touch = e.changedTouches[0];
  if (dragState.ghost) dragState.ghost.style.display = 'none';
  const under = document.elementFromPoint(touch.clientX, touch.clientY);
  if (dragState.ghost) dragState.ghost.style.display = '';
  if (under) {
    const t = under.closest('.slot[data-drop-type], .card[data-player-id]');
    if (t && t.dataset.playerId !== dragState.playerId) {
      executeDragSwap(dragState.sourceType, dragState.playerId, dragState.sourceSlotIdx,
        t.dataset.dropType, t.dataset.playerId, t.dataset.slotIndex ?? null);
      clearDragVisuals(); dragState._srcEl = null; render(); return;
    }
  }
  clearDragVisuals(); dragState._srcEl = null;
}, { passive: true });

// Ficha viva del onboarding: nombre e inicial se actualizan mientras se tipea,
// SIN re-renderear (un render() ahí perdería el caret del input).
app.addEventListener('input', (e) => {
  if (e.target?.id !== 'ob-dt') return;
  ui.onboarding.nombre = e.target.value;
  const nombre = e.target.value.trim() || 'DT';
  const elNombre = document.getElementById('ob-ficha-nombre');
  const elInicial = document.getElementById('ob-ficha-inicial');
  if (elNombre) elNombre.textContent = nombre;
  if (elInicial) elInicial.textContent = (nombre[0] || 'D').toUpperCase();
});

// Foil que sigue al cursor en cartas oro_unico/epica. Delegado en `app` (no por
// carta) porque el DOM se reconstruye entero en cada render().
app.addEventListener('pointermove', (e) => {
  const card = e.target.closest('.card[data-rarity="oro_unico"], .card[data-rarity="epica"]');
  if (!card) return;
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
  card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
});

// Cierra los dropdowns del onboarding al tocar afuera. Si el click es sobre el
// input de nombre no se cierra: un render() ahí perdería el caret mientras se tipea.
document.addEventListener('click', (e) => {
  if (!ui.onboarding?.abierto) return;
  if (e.target.closest('.dropdown') || e.target.closest('input')) return;
  ui.onboarding.abierto = null;
  render();
});

// Crear DT pasa SIEMPRE por onboarding: es la única vía que carga ligas y clubes
// reales desde Supabase y crea el manager que le pasa manager_id a open-pack.
// No hay "resume": cada carrera arranca con un perfil nuevo, así que el intro
// legacy (clubes genéricos, sin ligas) no se usa en el arranque.
ui.vista = 'onboarding';
render();
