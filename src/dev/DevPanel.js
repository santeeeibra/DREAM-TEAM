// DevPanel.js — botón flotante 🛠️ + panel de herramientas de desarrollador.
// Vive como elementos sueltos en <body>, fuera de Phaser y de las 3
// pantallas que arma main.js (auth / crear DT / app), así que queda
// visible SIEMPRE sin importar en qué pantalla estemos.
//
// Gateado por import.meta.env.DEV (ver comentario en initDevPanel): si
// alguien corre `npm run build`, esta función no crea absolutamente nada.
import {
  ESCENAS_DISPONIBLES,
  simularAperturaDeSobres,
  irAPantalla,
  vaciarPlantel,
  resetearCuenta,
} from './devActions.js';

// Estilos propios del panel, con nombres de clase "devpanel-*" para no
// pisar nada de style.css. A propósito usa colores (negro/naranja a
// rayas) totalmente distintos del resto del juego, para que nadie lo
// confunda con una función real.
const ESTILOS = `
  .devpanel-boton-flotante {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 99999;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 2px solid #ffb300;
    background: repeating-linear-gradient(45deg, #1a1a1a, #1a1a1a 6px, #2a2a2a 6px, #2a2a2a 12px);
    color: #ffb300;
    font-size: 22px;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
  }
  .devpanel-panel {
    position: fixed;
    bottom: 78px;
    right: 20px;
    z-index: 99999;
    width: 280px;
    max-height: 70vh;
    overflow-y: auto;
    background: #161616;
    border: 2px solid #ffb300;
    border-radius: 8px;
    padding: 12px;
    font-family: monospace;
    color: #eee;
    display: none;
  }
  .devpanel-panel.devpanel-abierto {
    display: block;
  }
  .devpanel-banner {
    background: #ffb300;
    color: #1a1a1a;
    font-weight: bold;
    text-align: center;
    padding: 5px;
    border-radius: 4px;
    margin-bottom: 10px;
    font-size: 12px;
  }
  .devpanel-seccion-titulo {
    font-size: 11px;
    color: #999;
    margin: 10px 0 4px;
    text-transform: uppercase;
  }
  .devpanel-boton {
    display: block;
    width: 100%;
    text-align: left;
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    border-radius: 4px;
    padding: 6px 8px;
    margin-bottom: 6px;
    font-family: monospace;
    font-size: 12px;
    cursor: pointer;
  }
  .devpanel-boton:hover {
    background: #3a3a3a;
  }
  .devpanel-boton-peligro {
    border-color: #e74c3c;
    color: #e74c3c;
  }
  .devpanel-boton-peligro:hover {
    background: #4a1616;
  }
  .devpanel-estado {
    font-size: 11px;
    margin-top: 8px;
    white-space: pre-wrap;
    word-break: break-word;
    /* Alto fijo + scroll propio: así un mensaje largo (ok o error) no
       empuja el alto del panel entero, que está anclado por "bottom" y
       si creciera correría TODOS los botones de lugar en la pantalla. */
    height: 32px;
    overflow-y: auto;
  }
  .devpanel-estado-ok {
    color: #2ecc71;
  }
  .devpanel-estado-error {
    color: #e74c3c;
  }
`;

// initDevPanel es la única función que exporta este archivo. Se llama una
// sola vez desde main.js, sin ningún "if" alrededor: el chequeo de
// import.meta.env.DEV vive acá adentro para que quede en un solo lugar.
//
// import.meta.env.DEV lo define Vite automáticamente: es `true` cuando
// corrés `npm run dev` (o `vite`) y queda `false` (y este código se borra
// del bundle final) cuando corrés `npm run build`. Por eso no hace falta
// una variable de entorno propia ni nada que configurar a mano.
export function initDevPanel() {
  if (!import.meta.env.DEV) return;

  const estilos = document.createElement('style');
  estilos.textContent = ESTILOS;
  document.head.appendChild(estilos);

  const boton = document.createElement('button');
  boton.className = 'devpanel-boton-flotante';
  boton.textContent = '🛠️';
  boton.title = 'Panel de desarrollador';
  document.body.appendChild(boton);

  const panel = document.createElement('div');
  panel.className = 'devpanel-panel';
  document.body.appendChild(panel);

  const estado = document.createElement('div');
  estado.className = 'devpanel-estado';

  boton.addEventListener('click', () => {
    panel.classList.toggle('devpanel-abierto');
  });

  // ejecutarAccion envuelve cada botón: muestra "Ejecutando..." mientras
  // corre, y al terminar escribe el resultado (ok o el mensaje de error)
  // en el cartelito de estado de abajo del panel. alTerminarOk es opcional
  // y solo se llama si fn() no tiró error (ej: para recién ahí cerrar el
  // panel) — así, si algo falla (como no tener manager todavía), el panel
  // se queda abierto y el mensaje de error queda visible.
  async function ejecutarAccion(fn, textoOk, alTerminarOk) {
    estado.textContent = 'Ejecutando...';
    estado.className = 'devpanel-estado';
    try {
      await fn();
      estado.textContent = textoOk;
      estado.className = 'devpanel-estado devpanel-estado-ok';
      alTerminarOk?.();
    } catch (error) {
      console.error('[DevPanel]', error);
      estado.textContent = 'Error: ' + error.message;
      estado.className = 'devpanel-estado devpanel-estado-error';
    }
  }

  function crearBoton(texto, alHacerClick, esPeligroso = false) {
    const b = document.createElement('button');
    b.className = esPeligroso ? 'devpanel-boton devpanel-boton-peligro' : 'devpanel-boton';
    b.textContent = texto;
    b.addEventListener('click', alHacerClick);
    panel.appendChild(b);
    return b;
  }

  const banner = document.createElement('div');
  banner.className = 'devpanel-banner';
  banner.textContent = '⚠ MODO DEV ⚠';
  panel.appendChild(banner);

  // Botón 1: simular apertura de 5 sobres. El panel se cierra recién si
  // salió bien, así se ve la animación; si falla (ej: sin manager
  // todavía), se queda abierto con el error a la vista.
  crearBoton('🎁 Simular apertura de 5 sobres', () => {
    ejecutarAccion(simularAperturaDeSobres, '25 cartas nuevas guardadas y animación arrancada.', () => {
      panel.classList.remove('devpanel-abierto');
    });
  });

  // Botón 2: ir a pantalla (una por escena existente).
  const tituloEscenas = document.createElement('div');
  tituloEscenas.className = 'devpanel-seccion-titulo';
  tituloEscenas.textContent = 'Ir a pantalla:';
  panel.appendChild(tituloEscenas);

  for (const escena of ESCENAS_DISPONIBLES) {
    crearBoton('→ ' + escena.label, () => {
      ejecutarAccion(() => irAPantalla(escena.value), `En ${escena.label}.`, () => {
        panel.classList.remove('devpanel-abierto');
      });
    });
  }

  const tituloAcciones = document.createElement('div');
  tituloAcciones.className = 'devpanel-seccion-titulo';
  tituloAcciones.textContent = 'Datos:';
  panel.appendChild(tituloAcciones);

  // Botón 3: vaciar plantel (solo las 25 cartas).
  crearBoton('🗑️ Vaciar plantel (borra las 25 cartas)', () => {
    ejecutarAccion(vaciarPlantel, 'Plantel vaciado. Volvé a "Colección" o "Armar 11" para verlo.');
  });

  // Botón 4: resetear cuenta entera. Pide confirmación porque borra datos
  // de verdad (managers, user_cards, lineups, seasons, season_events).
  crearBoton(
    '☠️ Resetear mi cuenta',
    () => {
      const confirmado = window.confirm(
        '¿Estás seguro? Esto borra tu manager, tus 25 cartas, tu lineup y tu temporada. No se puede deshacer.'
      );
      if (!confirmado) return;

      ejecutarAccion(async () => {
        await resetearCuenta();
        // Recargamos la página: así main.js vuelve a chequear "¿tiene
        // manager?" desde cero y te manda directo al formulario de crear DT.
        location.reload();
      }, 'Cuenta borrada, recargando...');
    },
    true
  );

  panel.appendChild(estado);
}
