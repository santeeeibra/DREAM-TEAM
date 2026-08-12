// CAPA VISUAL. Sólo lee el motor y llama a sus funciones: no calcula reglas ni efectos.
import {
  iniciarCarrera, confirmarOnce, jugarTramo, candidatosDelTramo, fijarNarracion,
  resolverEvento, abrirRefuerzo, registrarRefuerzo, aplicarRefuerzo, resumenCarrera, ratingActual,
  contexto, FASES, autoOnce, FORMACION, ratingEnSlot, penalidad, slotsVacios, posiciones, miPosicion,
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
  onboarding: { liga: null, clubes: [], clubId: '', nombre: '', pais: '', cargando: false, error: null, enviando: false, abierto: null, modo: 'facil', modoJuego: 'liga' },
  draftPuro: null,
};
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

// Silueta de fallback cuando el jugador no tiene foto (mismo trazo que antes,
// ahora es el <img src> por defecto en vez de una rama de markup aparte).
const SIL_CARTA = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3f49"/><stop offset="1" stop-color="#20242b"/></linearGradient></defs><rect width="200" height="200" fill="#181b21"/><circle cx="100" cy="78" r="40" fill="url(#g)"/><path d="M30 200c0-42 32-66 70-66s70 24 70 66z" fill="url(#g)"/></svg>');

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

// Modo País: país del DT → league_id para filtrar pool de cartas.
const PAIS_A_LIGA = new Map([
  ['Argentina',      'ligapro'],
  ['España',         'laliga'],
  ['Italia',         'seriea'],
  ['Alemania',       'bundesliga'],
  ['Francia',        'ligue1'],
  ['Inglaterra',     'premier'],
  ['Estados Unidos', 'mls'],
]);

const MODOS_JUEGO_UI = [
  { id: 'liga',   ico: '⚽', nombre: 'Liga',   desc: 'Solo cartas de tu liga' },
  { id: 'global', ico: '🌍', nombre: 'Global', desc: 'Todas las ligas' },
  { id: 'budget', ico: '💸', nombre: 'Budget', desc: '$4M para arrancar' },
  { id: 'draft',  ico: '🎲', nombre: 'Draft',  desc: 'Elegís 1 de 4 por carta' },
  { id: 'pais',   ico: '🏴', nombre: 'País',   desc: 'Cartas de tu país' },
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
function carta(x, { sel = false, accion = '', slot = null, bloqueada = false, motivo = '', i = 0 } = {}) {
  const pen = slot ? penalidad(x.pos, slot) : 0;
  const efectivo = slot ? ratingEnSlot(x, slot) : x.rating;
  const clasePen = pen === 0 ? '' : pen === FUERZA.PENALIDAD_POSICION.VECINO ? ' pen-vecino' : ' pen-fuera';
  const num = pen === 0
    ? `<div class="num">${efectivo}</div>`
    : `<div class="num-cambio"><span class="orig">${x.rating}</span><span class="flecha">→</span><span class="efectivo">${efectivo}</span></div>`;
  const attrs = accion && !bloqueada ? `data-accion="${accion}" data-id="${x.id}"` : '';
  return `<div class="carta-slot" style="--i:${i}">
    <div class="card${clasePen} ${sel ? 'sel' : ''} ${bloqueada ? 'bloqueada' : ''}" data-rarity="${x.rareza}" ${attrs}>
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
    const dir = k === 'ratingDelta' ? 'fuerza' : MALO_SI_SUBE.has(k) ? '↓ mejor' : '↑ mejor';
    const estado = critico ? 'CRITICO' : alerta ? 'ALERTA' : null;
    return `<div class="gauge ${critico ? 'bad' : alerta ? 'warn' : ''}">
      <div class="gauge-head">
        <div class="lbl">${NOMBRE_VAR[k]}</div>
        <div class="val">${k === 'money' ? fmtMoney(v) : v}</div>
      </div>
      <div class="bar"><i style="width:${pctv}%"></i></div>
      <div class="gauge-foot">
        <span class="dir">${estado ?? dir}</span>
        ${d ? `<span class="delta on ${d === 0 ? '' : (MALO_SI_SUBE.has(k) ? d < 0 : d > 0) ? 'pos' : 'neg'}">${signoDelta(k, d)}${Math.abs(d)}</span>` : ''}
      </div>
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
            const paisLiga = PAIS_A_LIGA.get(ob.pais);
            const ligaLabel = LIGAS.find((l) => l.id === paisLiga)?.label;
            return ({
              liga:   'Solo cartas de la liga elegida. El modo estándar.',
              global: 'Pool completo: jugadores de todas las ligas.',
              budget: 'Arrancás con $4M. Cada decisión económica duele.',
              draft:  'Elegís 1 de 4 cartas por slot. Sin economía inicial.',
              pais:   ob.pais
                ? (paisLiga ? `Cartas de jugadores de ${ligaLabel || paisLiga}.` : `Pool global — ${ob.pais} no tiene liga mapeada.`)
                : 'Elegí tu país para ver el pool disponible.',
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
          <div class="ob-ficha-pie"><span class="ob-ficha-sobre">×3 sobres gratis</span></div>
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
    </div>`;
  },

  once: () => {
    const porId = new Map(c.plantel.map((x) => [x.id, x]));
    const lineas = [[0], [3, 1, 2, 4], [5, 6, 7], [8, 10, 9]];
    const banco = c.plantel.filter((x) => !c.once.includes(x.id));
    const vacios = slotsVacios(c.once);
    const sinArquero = vacios.some((i) => FORMACION[i] === 'ARQ');
    const slot = (i) => {
      const x = porId.get(c.once[i]);
      const pen = x ? penalidad(x.pos, FORMACION[i]) : 0;
      const clase = pen === 0 ? '' : pen === FUERZA.PENALIDAD_POSICION.VECINO ? 'vecino' : 'fuera';
      const efectivo = x ? ratingEnSlot(x, FORMACION[i]) : null;
      // Puesto sin cubrir: mismo molde de mini-carta, atenuado. Con penalidad se
      // muestra el rating efectivo + el original tachado (misma semántica que la carta).
      const num = !x
        ? '<span class="slot-rating slot-rating-vacio">—</span>'
        : pen === 0
          ? `<span class="slot-rating">${efectivo}</span>`
          : `<span class="slot-rating">${efectivo}</span><span class="slot-orig">${x.rating}</span>`;
      return `<div class="slot ${ui.slot === i ? 'activo' : ''} ${clase} ${x ? '' : 'vacio'}" data-accion="slot" data-i="${i}"${x && x.nombre ? ` title="${esc(x.nombre)}"` : ''}>
        <div class="slot-card${x ? '' : ' slot-card-vacio'}" data-rarity="${x ? x.rareza : 'bronce'}">
          <div class="slot-card-inner">
            <div class="slot-photo"><img src="${x && x.foto ? esc(x.foto) : SIL_CARTA}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='${SIL_CARTA}'"></div>
            <div class="slot-head">
              <span class="slot-pos">${FORMACION[i]}</span>
              <span class="slot-num">${num}</span>
            </div>
            <div class="slot-name">${x ? esc(x.nombre) : 'vacío'}</div>
          </div>
        </div>
      </div>`;
    };
    const slotElegido = ui.slot !== null ? FORMACION[ui.slot] : null;
    // Recomendación por puesto: primero los naturales al slot (penalidad 0), después
    // línea vecina (VECINO), al final fuera de posición (FUERA); dentro de cada grupo, el mejor
    // rating efectivo para ese slot primero. Mismo criterio que usa autoOnce.
    const candidatos = ui.slot === null ? [] : [...banco, ...c.once.map((id) => porId.get(id))].filter(Boolean)
      .sort((a, b) =>
        penalidad(a.pos, slotElegido) - penalidad(b.pos, slotElegido) ||
        ratingEnSlot(b, slotElegido) - ratingEnSlot(a, slotElegido));
    return `<div class="stack">
      <div class="eyebrow">${c.temporada === 1 ? 'Paso 2 de 2 · ' : `Temporada ${c.temporada} · `}Once titular · 4-3-3</div>
      <h2>Rating del 11: <span style="color:var(--fluor)">${ratingActual(c)}</span></h2>
      ${sinArquero ? '<p class="aviso">No tenés ningún arquero disponible. El arco solo lo puede ocupar un POR: conseguí uno antes de empezar.</p>' : ''}
      ${!sinArquero && vacios.length ? `<p class="aviso">Quedan ${vacios.length} puesto(s) sin cubrir. Tocá el puesto vacío para elegir jugador.</p>` : ''}
      <div class="cancha-grid">${lineas.map((l) => `<div class="linea-f">${l.map(slot).join('')}</div>`).join('')}</div>
      <p class="hint">${slotElegido
        ? `Elegí quién juega de <b>${slotElegido}</b>. Cada carta muestra su rating real y el que rinde en este puesto: <span class="pen-vecino-tx">ámbar −${FUERZA.PENALIDAD_POSICION.VECINO}</span> si es una línea vecina, <span class="pen-fuera-tx">rojo −${FUERZA.PENALIDAD_POSICION.FUERA}</span> si está fuera de posición.`
        : 'Tocá un puesto para cambiar al jugador. En ámbar o rojo: jugador fuera de su puesto natural.'}</p>
      ${slotElegido ? `<div class="grid-cartas">${candidatos.map((x, i) => carta(x, { accion: 'poner', slot: slotElegido, i })).join('')}</div>` : ''}
      <div class="row">
        <button class="btn" data-accion="confirmar-once">${c.temporada === 1 ? 'Empezar la temporada' : 'Confirmar y seguir'}</button>
        <button class="btn ghost" data-accion="auto-once">Armado automático</button>
      </div>
    </div>`;
  },

  previa: () => {
    const desde = c.partidosTemporada.length + 1;
    return `<div class="stack${tsEntra ? ' ts-anim' : ''}">
      ${marcador()}
      <div class="panel stack ts-tramo">
        <div class="ts-tramo-tag"><i></i>Tramo ${c.tramo + 1} de ${LIGA.TRAMOS.length}</div>
        <h2>Fechas <span class="ts-glow">${desde} a ${desde + LIGA.TRAMOS[c.tramo] - 1}</span></h2>
        <p class="hint">Se juegan ${LIGA.TRAMOS[c.tramo]} partidos de corrido. Después vas a tener que tomar una decisión.</p>
        <div class="row">
          <button class="btn ts-cta" data-accion="jugar">Jugar el tramo</button>
          <button class="btn ghost" data-accion="ir-once">Cambiar el 11</button>
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

function render() {
  tsEntra = tsVistaAnterior !== ui.vista;
  tsVistaAnterior = ui.vista;
  app.innerHTML = PANTALLAS[ui.vista]();
  window.scrollTo({ top: 0, behavior: 'instant' });
  setTimeout(() => { ui.deltas = null; }, 1800);
}

// ───────────────────────── acciones ─────────────────────────
const acciones = {
  'ob-modo'(el) { ui.onboarding.modo = el.dataset.modo; render(); },
  'ob-pais'(el) {
    const ob = ui.onboarding;
    ob.nombre = document.getElementById('ob-dt')?.value ?? ob.nombre;
    if (el.dataset.pais) { ob.pais = el.dataset.pais; ob.abierto = null; }
    else ob.abierto = ob.abierto === 'pais' ? null : 'pais';
  },
  'ob-club'(el) {
    const ob = ui.onboarding;
    ob.nombre = document.getElementById('ob-dt')?.value ?? ob.nombre;
    if (el.dataset.id) { ob.clubId = el.dataset.id; ob.abierto = null; }
    else if (!ob.cargando) ob.abierto = ob.abierto === 'club' ? null : 'club';
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
    const leagueIdPool =
      modoJuego === 'global' ? null
      : modoJuego === 'pais'  ? (PAIS_A_LIGA.get(ob.pais) || null)
      : ob.liga; // liga, budget, draft

    ui.miEscudo = club?.badge_url || club?.club_badge_url || club?.badge || '';

    if (modoJuego === 'draft') {
      // Draft Puro: abrimos el pool pero NO guardamos en user_cards todavía
      let grupos = [];
      try {
        const { openDraftPool } = await import('../data/cardsRepo.js');
        grupos = await openDraftPool(managerId, leagueIdPool);
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
      sobresInicialesDB = await openInitialPacks(managerId, leagueIdPool);
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
    });
    ob.enviando = false;
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
  'ob-set-modo'(el) { ui.onboarding.modoJuego = el.dataset.modo; },
  'abrir-sobre'(el) { ui.sobresAbiertos.push(Number(el.dataset.i)); },
  'ir-once'() { ui.vista = 'once'; ui.slot = null; if (!c.once.length) c.once = autoOnce(c.plantel); },
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
      if (!c.once.length) c.once = autoOnce(c.plantel);
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
    'auto-once'() { c.once = autoOnce(c.plantel); ui.slot = null; },
  'confirmar-once'() { confirmarOnce(c, c.once); ui.vista = 'previa'; },
  jugar() {
    jugarTramo(c);
    ui.deltas = c.ultimoTramo?.deltas || null;
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
    ui.vista = c.fase === FASES.FIN ? 'fin' : c.fase === FASES.RESUMEN ? 'resumen' : 'previa';
  },
  async 'abrir-refuerzo'() {
    // Capa exterior: pedimos el sobre a Supabase. Si falla (devuelve null),
    // el motor genera el sobre local síncrono — la carrera nunca se traba.
    // Import dinámico: el cliente Supabase (y su dependencia del paquete npm)
    // no se carga al arrancar el juego, y si no se puede resolver, el fallback
    // local del motor igual funciona.
    const { fetchAbrirSobre } = await import('../net/supabaseClient.js');
    const managerId = localStorage.getItem('manager_id');
    const cartasDB = managerId
      ? await fetchAbrirSobre({ managerId, packId: PACK_ID, free: false })
      : null;
    if (cartasDB) registrarRefuerzo(c, cartasDB);
    else abrirRefuerzo(c);
    ui.sel = new Set(); ui.salen = new Set(); ui.vista = 'refuerzo';
  },
  'sel-refuerzo'(el) { const id = el.dataset.id; ui.sel.has(id) ? ui.sel.delete(id) : ui.sel.add(id); },
  'sel-venta'(el) { const id = el.dataset.id; ui.salen.has(id) ? ui.salen.delete(id) : ui.salen.add(id); },
  'confirmar-refuerzo'() {
    aplicarRefuerzo(c, [...ui.sel], [...ui.salen]);
    ui.vista = 'once'; ui.slot = null;
  },
  tabla() { ui.tabla = !ui.tabla; },
  reiniciar() {
    c = null;
    ui = { ...ui, vista: 'onboarding', tabla: false, sobresAbiertos: [] };
    ui.onboarding.abierto = null;
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
