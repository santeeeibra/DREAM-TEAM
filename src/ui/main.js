// CAPA VISUAL. Sólo lee el motor y llama a sus funciones: no calcula reglas ni efectos.
import {
  iniciarCarrera, confirmarOnce, jugarTramo, candidatosDelTramo, fijarNarracion,
  resolverEvento, abrirRefuerzo, registrarRefuerzo, aplicarRefuerzo, resumenCarrera, ratingActual,
  contexto, FASES, autoOnce, FORMACION, ratingEnSlot, penalidad, slotsVacios, posiciones, miPosicion,
  paquete, valorDeVenta, CARRERA, LIGA, RANGOS,
} from '../engine/index.js';
import { CLUBES_JUGABLES } from '../data/nombres.js';
import { pedirNarracion } from '../net/evento.js';

const app = document.getElementById('app');
// Único pack disponible por ahora (Sobre Dream Team): se usa tanto para los
// 3 sobres gratis del onboarding como para el sobre de refuerzo post-temporada.
const PACK_ID = 'b34f5178-ad24-47b8-a957-5c4c6c7e6587';
let c = null;
let ui = {
  vista: 'intro', vistaAnterior: 'intro', slot: null, sobresAbiertos: [], deltas: null, tabla: false,
  sel: new Set(), salen: new Set(), fuenteIA: null, cargando: false,
  onboarding: { liga: null, clubes: [], clubId: '', nombre: '', pais: '', cargando: false, error: null, enviando: false, abierto: null },
};

// ───────────────────────── helpers de vista ─────────────────────────
const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const ICONO = { money: '💰', moral: '😊', fatiga: '🔋', presion: '🔥', ratingDelta: '⭐' };
const NOMBRE_VAR = { money: 'Plata', moral: 'Moral', fatiga: 'Fatiga', presion: 'Presión', ratingDelta: 'Nivel' };
// fatiga y presión: subir es malo. El resto: subir es bueno.
const MALO_SI_SUBE = new Set(['fatiga', 'presion']);

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
const banderaImg = (nombre) => {
  const code = BANDERAS.get(nombre);
  return code
    ? `<img class="flag" src="https://flagcdn.com/w40/${code}.png" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" />`
    : '';
};

// Botones de liga con logo oficial (CDN público temporal; onerror lo oculta).
const LIGAS = [
  { id: 'premier', label: 'Premier League', logo: 'https://media.api-sports.io/football/leagues/39.png' },
  { id: 'laliga', label: 'LaLiga', logo: 'https://media.api-sports.io/football/leagues/140.png' },
];

// Escudo del club: sale de la fila de `clubs` si trae columna de escudo
// (badge_url / club_badge_url / badge). Si no viene o el CDN falla, el onerror
// lo oculta y queda el nombre — mismo patrón que las fotos de carta.
const escudoDe = (cl) => {
  const badge = cl.badge_url || cl.club_badge_url || cl.badge || '';
  return badge
    ? `<img class="escudo" src="${esc(badge)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" />`
    : '';
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

// money se guarda en millones (1 decimal, ver state.js/balance.js); la UI lo
// muestra como dólares enteros con separador de miles en puntos (formato es-AR).
const fmtMoney = (v) => 'U$D ' + String(Math.round(v * 1_000_000)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');


const LABEL_RAREZA = { bronce: 'Bronce', oro_comun: 'Oro común', oro_unico: 'Oro único', epica: 'Épica' };

// slot: si viene, la carta muestra su rating EN ESE PUESTO ("88 → 82") y el motivo del descuento.
// i: índice dentro de la grilla, maneja el reveal escalonado (--i).
function carta(x, { sel = false, accion = '', slot = null, bloqueada = false, motivo = '', i = 0 } = {}) {
  const pen = slot ? penalidad(x.pos, slot) : 0;
  const efectivo = slot ? ratingEnSlot(x, slot) : x.rating;
  const clasePen = pen === 0 ? '' : pen <= 2 ? ' pen-vecino' : ' pen-fuera';
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
    return `<div class="gauge ${critico ? 'bad' : alerta ? 'warn' : ''}">
      <div class="lbl">${NOMBRE_VAR[k]}</div>
      <div class="val">${k === 'money' ? fmtMoney(v) : v}</div>
      <div class="bar"><i style="width:${pctv}%"></i></div>
      ${d ? `<span class="delta on ${d === 0 ? '' : (MALO_SI_SUBE.has(k) ? d < 0 : d > 0) ? 'pos' : 'neg'}">${signoDelta(k, d)}${Math.abs(d)}</span>` : ''}
    </div>`;
  };
  const cinta = c.liga ? `<div class="cinta">${Array.from({ length: LIGA.FECHAS }, (_, i) => {
    const p = c.partidosTemporada[i];
    return `<i class="${p ? p.res : ''} ${i === c.partidosTemporada.length ? 'hoy' : ''}"></i>`;
  }).join('')}</div>` : '';

  return `<div class="marcador">
    <div class="top">
      <div class="club">${esc(c.club)}</div>
      <div class="row" style="gap:10px">
        <div class="eyebrow">T${c.temporada}/${CARRERA.TEMPORADAS} · Fecha ${Math.min(c.partidosTemporada.length + 1, LIGA.FECHAS)} · ${pos ? `${pos}°` : '—'} · Objetivo ${c.objetivo}°</div>
        <button class="btn ghost" style="padding:2px 9px;font-size:13px" data-accion="ver-guia" title="Cómo funcionan las variables">?</button>
      </div>
    </div>
    <div class="gauges">${['money', 'moral', 'fatiga', 'presion', 'ratingDelta'].map(g).join('')}</div>
    ${cinta}
  </div>`;
}

function tablaPosiciones() {
  if (!c.liga) return '';
  const t = posiciones(c.liga);
  return `<div class="panel stack">
    <div class="row" style="justify-content:space-between">
      <div class="eyebrow">Tabla de posiciones</div>
      <button class="btn ghost" data-accion="tabla">${ui.tabla ? 'Ocultar' : 'Ver tabla'}</button>
    </div>
    ${ui.tabla ? `<table><thead><tr><th>#</th><th>Equipo</th><th class="n">PJ</th><th class="n">DG</th><th class="n">Pts</th></tr></thead>
      <tbody>${t.map((e, i) => `<tr class="${e.id === 0 ? 'mio' : ''}"><td class="n">${i + 1}</td><td>${esc(e.nombre)}</td><td class="n">${e.pj}</td><td class="n">${e.dg > 0 ? '+' : ''}${e.dg}</td><td class="n">${e.pts}</td></tr>`).join('')}</tbody></table>` : ''}
  </div>`;
}

// ───────────────────────── pantallas ─────────────────────────
const PANTALLAS = {
  onboarding: () => {
    const ob = ui.onboarding;
    const clubSel = ob.clubes.find((cl) => cl.id === ob.clubId);
    const clubBtn = !ob.liga
      ? 'Elegí una liga primero'
      : ob.cargando
        ? 'Cargando clubes…'
        : ob.clubes.length === 0
          ? 'No hay clubes para esta liga'
          : clubSel ? clubSel.name : 'Elegí tu club';
    return `
    <div class="stack" style="padding-top:8vh">
      <div class="eyebrow">Antes de arrancar</div>
      <h1>Creá tu<br>perfil de DT</h1>
      <p style="max-width:42ch;color:var(--humo)">Esto se hace una sola vez: tu nombre, de dónde venís y qué club vas a dirigir. Después abrís tus tres sobres iniciales y arrancás la carrera.</p>
      <div class="panel stack" style="max-width:440px">
        <label class="eyebrow" for="ob-dt">Tu nombre</label>
        <input id="ob-dt" maxlength="24" placeholder="Nombre del DT" value="${esc(ob.nombre)}" />
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
          <button type="button" class="btn liga-btn ${ob.liga === l.id ? '' : 'ghost'}" data-accion="ob-liga" data-liga="${l.id}">
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
        ${ob.error ? `<p class="aviso">${esc(ob.error)}</p>` : ''}
        <button class="btn" data-accion="ob-confirmar" ${ob.enviando ? 'disabled' : ''}>${ob.enviando ? 'Creando perfil…' : 'Firmar contrato'}</button>
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
      <h2>Tus tres sobres</h2>
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
      const clase = pen === 0 ? '' : pen <= 2 ? 'vecino' : 'fuera';
      return `<div class="slot ${ui.slot === i ? 'activo' : ''} ${clase} ${x ? '' : 'vacio'}" data-accion="slot" data-i="${i}">
        <div class="sl">${FORMACION[i]}</div>
        <div class="sr">${x ? ratingEnSlot(x, FORMACION[i]) : '—'}</div>
        <div class="sn">${x ? esc(x.nombre.split(' ')[0]) : 'vacío'}</div>
      </div>`;
    };
    const slotElegido = ui.slot !== null ? FORMACION[ui.slot] : null;
    const candidatos = ui.slot === null ? [] : [...banco, ...c.once.map((id) => porId.get(id))].filter(Boolean);
    return `<div class="stack">
      <div class="eyebrow">${c.temporada === 1 ? 'Paso 2 de 2 · ' : `Temporada ${c.temporada} · `}Once titular · 4-3-3</div>
      <h2>Rating del 11: <span style="color:var(--fluor)">${ratingActual(c)}</span></h2>
      ${sinArquero ? '<p class="aviso">No tenés ningún arquero disponible. El arco solo lo puede ocupar un POR: conseguí uno antes de empezar.</p>' : ''}
      ${!sinArquero && vacios.length ? `<p class="aviso">Quedan ${vacios.length} puesto(s) sin cubrir. Tocá el puesto vacío para elegir jugador.</p>` : ''}
      <div class="cancha-grid">${lineas.map((l) => `<div class="linea-f">${l.map(slot).join('')}</div>`).join('')}</div>
      <p class="hint">${slotElegido
        ? `Elegí quién juega de <b>${slotElegido}</b>. Cada carta muestra su rating real y el que rinde en este puesto: <span class="pen-vecino-tx">ámbar −2</span> si es una línea vecina, <span class="pen-fuera-tx">rojo −6</span> si está fuera de posición.`
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
    return `<div class="stack">
      ${marcador()}
      <div class="panel stack">
        <div class="eyebrow">Tramo ${c.tramo + 1} de ${LIGA.TRAMOS.length}</div>
        <h2>Fechas ${desde} a ${desde + LIGA.TRAMOS[c.tramo] - 1}</h2>
        <p class="hint">Se juegan ${LIGA.TRAMOS[c.tramo]} partidos de corrido. Después vas a tener que tomar una decisión.</p>
        <div class="row">
          <button class="btn" data-accion="jugar">Jugar el tramo</button>
          <button class="btn ghost" data-accion="ir-once">Cambiar el 11</button>
        </div>
      </div>
      ${tablaPosiciones()}
    </div>`;
  },

  resultados: () => {
    const t = c.ultimoTramo;
    return `<div class="stack">
      ${marcador()}
      <div class="panel stack">
        <div class="eyebrow">Resultados del tramo · ${t.pts} de ${t.partidos.length * 3} puntos</div>
        <div>${t.partidos.map((p) => `<div class="partido">
          <span><span class="res ${p.res}">${p.res}</span> ${esc(p.rival)} <span class="muted">(${p.localia})</span></span>
          <span class="num">${p.gf}-${p.gc}</span></div>`).join('')}</div>
        <div class="row"><button class="btn" data-accion="ir-evento">Seguir</button></div>
      </div>
      ${tablaPosiciones()}
    </div>`;
  },

  evento: () => {
    if (ui.cargando) {
      return `<div class="stack">${marcador()}
        <div class="panel evento stack"><div class="eyebrow">Punto de decisión</div>
        <h2 style="opacity:.4">Pasa algo en el club…</h2><p class="hint">Un segundo.</p></div></div>`;
    }
    const n = c.eventoActual.narracion;
    const p = paquete(n.paqueteId);
    return `<div class="stack">
      ${marcador()}
      <div class="panel evento stack">
        <div class="eyebrow">Temporada ${c.temporada} · Decisión ${c.tramo + 1}</div>
        <h2>${esc(n.titulo)}</h2>
        <p>${esc(n.texto)}</p>
        <div class="stack">
          ${n.opciones.map((o) => {
            const opcionCat = p.opciones.find((x) => x.id === o.id);
            const cuerpo = opcionCat.resultado
              ? opcionCat.resultado.map((r) => `
                  <div class="rama">
                    <span class="prob">${Math.round(r.prob * 100)}%</span>
                    <div class="chips">${Object.entries(r.efectos).map(([k, v]) => chip(k, v)).join('') || '<span class="chip">sin cambios</span>'}</div>
                  </div>`).join('')
              : `<div class="chips">${Object.entries(opcionCat.efectos).map(([k, v]) => chip(k, v)).join('')}</div>`;
            return `<button class="opcion" data-accion="elegir" data-op="${o.id}">
              <div style="font-weight:600">${esc(o.label)}</div>
              ${cuerpo}
            </button>`;
          }).join('')}
        </div>
        <div class="hint">Los íconos son las consecuencias reales (con su % cuando es una apuesta). El relato puede adornar; los números no mienten.</div>
      </div>
    </div>`;
  },

  resumen: () => {
    const t = c.ultimaTemporada;
    return `<div class="stack">
      ${marcador()}
      <div class="panel stack">
        <div class="eyebrow">Fin de la temporada ${t.temporada}</div>
        <h2>${t.campeon ? '¡Campeón!' : t.cumplio ? `${t.posicion}° — objetivo cumplido` : `${t.posicion}° — objetivo incumplido`}</h2>
        <p class="hint">${t.pts} puntos · ${t.g}G ${t.e}E ${t.p}P · ${t.gf}:${t.gc} · el club pedía terminar ${t.objetivo}° o mejor.</p>
        <table><tbody>${t.tablaTop5.map((x, i) => `<tr class="${x.nombre === c.club ? 'mio' : ''}"><td class="n">${i + 1}</td><td>${esc(x.nombre)}</td><td class="n">${x.pts}</td></tr>`).join('')}</tbody></table>
        <div class="row"><button class="btn" data-accion="abrir-refuerzo">Abrir el sobre de refuerzo</button></div>
      </div>
    </div>`;
  },

  refuerzo: () => {
    const entran = c.refuerzo.filter((x) => ui.sel.has(x.id));
    const exceso = Math.max(0, c.plantel.length + entran.length - CARRERA.PLANTEL_MAX);
    const faltan = Math.max(0, exceso - ui.salen.size);
    const ingreso = c.plantel.filter((x) => ui.salen.has(x.id)).reduce((s, x) => s + valorDeVenta(x), 0);
    return `<div class="stack">
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
};

function render() {
  app.innerHTML = PANTALLAS[ui.vista]();
  window.scrollTo({ top: 0, behavior: 'instant' });
  setTimeout(() => { ui.deltas = null; }, 1800);
}

// ───────────────────────── acciones ─────────────────────────
const acciones = {
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
    // Guardamos lo ya tipeado: el fetch de clubes dispara un render() antes de
    // terminar, y el innerHTML se reconstruye — sin esto se perdería lo escrito.
    ob.nombre = document.getElementById('ob-dt')?.value ?? ob.nombre;
    // El país ya vive en el estado (dropdown visual), no en un input.
    ob.liga = el.dataset.liga;
    ob.abierto = null;
    ob.cargando = true; ob.error = null; ob.clubes = []; ob.clubId = '';
    render();
    const { fetchClubsPorLiga } = await import('../net/supabaseClient.js');
    const clubes = await fetchClubsPorLiga(ob.liga);
    ob.cargando = false;
    if (clubes === null) {
      ob.error = 'No se pudieron cargar los clubes. Revisá tu conexión e intentá de nuevo.';
    } else {
      ob.clubes = clubes;
      ob.clubId = clubes[0]?.id || '';
      ob.error = clubes.length === 0 ? 'No hay clubes cargados para esta liga todavía.' : null;
    }
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
    const { crearManager, fetchAbrirSobre } = await import('../net/supabaseClient.js');
    const managerId = await crearManager({ name: ob.nombre, country: ob.pais, league_id: ob.liga, club_id: ob.clubId });
    if (!managerId) {
      ob.enviando = false;
      ob.error = 'No se pudo crear el perfil. Intentá de nuevo.';
      return;
    }
    localStorage.setItem('manager_id', managerId);
    const club = ob.clubes.find((cl) => cl.id === ob.clubId);
    const sobres = await Promise.all([
      fetchAbrirSobre({ managerId, packId: PACK_ID, free: true }),
      fetchAbrirSobre({ managerId, packId: PACK_ID, free: true }),
      fetchAbrirSobre({ managerId, packId: PACK_ID, free: true }),
    ]);
    const cartasInicialesDB = sobres.every(Boolean) ? sobres : null;
    c = iniciarCarrera({ dt: ob.nombre, club: club?.name || ob.nombre, cartasInicialesDB });
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
  'abrir-sobre'(el) { ui.sobresAbiertos.push(Number(el.dataset.i)); },
  'ir-once'() { ui.vista = 'once'; ui.slot = null; if (!c.once.length) c.once = autoOnce(c.plantel); },
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
    ui.vista = 'evento'; ui.cargando = true; render();
    const candidatos = candidatosDelTramo(c);
    const narracion = await pedirNarracion(candidatos, contexto(c));
    fijarNarracion(c, narracion); // si es null, el motor sortea y usa el catálogo
    ui.fuenteIA = c.eventoActual.narracion.fuente;
    ui.cargando = false;
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
