// EventScene.js — overlay con la "Tarjeta de Dilema" para mostrar un evento de
// temporada y dejar que el jugador elija una opción.
//
// Se lanza con scene.launch (no scene.start) sobre SeasonScene, así queda
// dibujada encima sin destruir la escena de fondo. Al elegir una opción se
// muestra un breve feedback visual con los deltas de option.effects, se llama
// a onResolve(option) — con la OPCIÓN COMPLETA (no solo el id), porque
// aplicarDecisionYContinuar en seasonOrchestrator.js lee decisionElegida.effects
// — y se cierra el overlay con scene.stop() una vez terminada la animación.
//
// El texto del evento pasa primero por api/narrar-evento.js para que Gemini
// lo narre en base al careerStateSnapshot actual (money/morale/fatiga/
// pressure/streak/ratingDelta). Mientras se espera esa respuesta se muestra
// un "Analizando la situación con el cuerpo técnico..." corto; los botones de
// opciones recién se pintan cuando ya hay texto definitivo (narración de la
// IA o, si falla/tarda, el fallback
// eventDetails.descripcion que ya devuelve el propio endpoint con status
// 200) — así nunca hay opciones activas sobre un texto a medio cargar.
import Phaser from 'phaser';
import * as careerState from '../state/careerState.js';
import * as logger from '../core/logger.js';

const NARRAR_EVENTO_ENDPOINT = '/api/narrar-evento';
const NARRAR_EVENTO_TIMEOUT_MS = 4000;

// --- Constantes de layout de la tarjeta ---
const PADDING_TARJETA = 28;
const RADIO_TARJETA = 14;
const ALTO_BOTON = 48;
const GAP_BOTONES = 14;
const GAP_BAJO_BADGE = 8;
const GAP_BAJO_TITULO = 12;
const GAP_BAJO_NARRACION = 18;
const ANCHO_TARJETA_MAX = 640;
const ESPACIO_SEPARADOR_BOTONES = 12;

// --- Config visual por tipo de evento ---
// colorBorde alimenta fillStyle/strokeStyle de Phaser.Graphics (hex numérico);
// colorTexto alimenta Phaser.Text (string '#RRGGBB').
const TIPOS_EVENTO = {
  CRISIS: { label: 'CRISIS', colorBorde: 0xe74c3c, colorTexto: '#FF6B5E' },
  SPONSOR: { label: 'SPONSOR', colorBorde: 0x2ecc71, colorTexto: '#5EEB9A' },
  LESION: { label: 'LESION', colorBorde: 0xe67e22, colorTexto: '#FFA14E' },
  MERCADO: { label: 'MERCADO', colorBorde: 0x3498db, colorTexto: '#6FB8F0' },
  GENERICO: { label: 'EVENTO', colorBorde: 0xd4af37, colorTexto: '#D4AF37' },
};

// inferirTipoEvento deriva la categoría visual a partir del id del evento:
// el catálogo real no tiene un campo "tipo" explícito, así que mapeamos por
// prefijo/keyword. Es solo estética: el borde de la tarjeta y el badge de
// arriba del título usan esta config.
function inferirTipoEvento(eventDetails) {
  const id = String(eventDetails?.id ?? '').toLowerCase();

  if (id.includes('crisis')) return TIPOS_EVENTO.CRISIS;
  if (id.includes('sponsor')) return TIPOS_EVENTO.SPONSOR;
  if (id.includes('lesion')) return TIPOS_EVENTO.LESION;
  if (id.includes('oferta') || id.includes('mercado')) return TIPOS_EVENTO.MERCADO;
  return TIPOS_EVENTO.GENERICO;
}

// inferirColorOpcion decide el tono del botón según el signo del effect
// dominante de esa opción. Es una heurística VISUAL, no lógica de juego: si la
// suma de los valores numéricos de option.effects es positiva -> verde; si es
// negativa -> rojo/ámbar; sin efectos o indeterminado -> dorado neutro.
function inferirColorOpcion(option) {
  const effects = option?.effects;

  if (!effects || typeof effects !== 'object') {
    return { fondo: 0xb8860b, borde: 0xd4af37, texto: '#1A1A2E' };
  }

  let suma = 0;
  Object.values(effects).forEach((valor) => {
    if (typeof valor === 'number' && !Number.isNaN(valor)) suma += valor;
  });

  if (suma > 0) return { fondo: 0x14532d, borde: 0x4ade80, texto: '#F2F3F5' };
  if (suma < 0) return { fondo: 0x7f1d1d, borde: 0xf87171, texto: '#F2F3F5' };
  return { fondo: 0xb8860b, borde: 0xd4af37, texto: '#1A1A2E' };
}

// aclararColorHex suma un offset fijo a cada canal RGB (con clamp en 255) para
// el estado hover de los botones: un tono más claro del mismo color.
function aclararColorHex(colorHex) {
  const r = Math.min(255, ((colorHex >> 16) & 0xff) + 40);
  const g = Math.min(255, ((colorHex >> 8) & 0xff) + 40);
  const b = Math.min(255, (colorHex & 0xff) + 40);
  return (r << 16) | (g << 8) | b;
}

// Labels legibles para el feedback flotante de option.effects. Las claves del
// catálogo son las "de negocio" { morale, fatigue, money, rating_efectivo };
// aceptamos también la variante normalizada (moraleDelta, moneyDelta, etc.).
const LABELS_EFFECTS = {
  morale: 'Moral',
  moraleDelta: 'Moral',
  fatigue: 'Fatiga',
  fatigueDelta: 'Fatiga',
  money: '$',
  moneyDelta: '$',
  rating_efectivo: 'Rating',
  ratingDelta: 'Rating',
  pressure: 'Presión',
  pressureDelta: 'Presión',
  streak: 'Racha',
};

// formatearEfecto arma el texto del feedback: "+5 Moral", "-3000 $" (con el
// signo explícito y redondeado para valores decimales).
function formatearEfecto(clave, valor) {
  const label = LABELS_EFFECTS[clave] ?? clave;
  const numero = Math.round(valor);
  const signo = numero > 0 ? '+' : '';

  if (clave === 'money' || clave === 'moneyDelta') {
    return `${signo}${numero} $`;
  }
  return `${signo}${numero} ${label}`;
}

export class EventScene extends Phaser.Scene {
  constructor() {
    super('EventScene');
  }

  // data = { eventDetails, onResolve }.
  // eventDetails = { id, titulo, descripcion, options: [{ id, label, effects }] }.
  init(data) {
    this.eventDetails = data.eventDetails;
    this.onResolve = data.onResolve;
  }

  create() {
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    this.cx = anchoPantalla / 2;
    this.cy = altoPantalla / 2;
    this.resolviendo = false;
    this.botones = [];
    this.tipoEvento = inferirTipoEvento(this.eventDetails);

    // Overlay semitransparente (se mantiene: 0x000000 al 75%).
    this.add.rectangle(this.cx, this.cy, anchoPantalla, altoPantalla, 0x000000, 0.75);

    // Fondo de la tarjeta: Graphics redibujado por dibujarTarjeta() cada vez
    // que cambia el texto (placeholder -> narración) o aparecen los botones.
    this.graphicsTarjeta = this.add.graphics();
    this.graphicsSeparador = this.add.graphics();

    // Badge con el tipo de evento (arriba del título).
    this.badgeTipo = this.add
      .text(0, 0, this.tipoEvento.label, {
        fontFamily: 'Manrope',
        fontSize: '13px',
        fontStyle: 'bold',
        color: this.tipoEvento.colorTexto,
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    this.textoTitulo = this.add
      .text(0, 0, this.eventDetails.titulo, {
        fontFamily: 'Rajdhani',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#D4AF37',
        align: 'center',
        wordWrap: { width: ANCHO_TARJETA_MAX - PADDING_TARJETA * 2 },
      })
      .setOrigin(0.5);

    this.textoEvento = this.add
      .text(0, 0, 'Analizando la situación con el cuerpo técnico...', {
        fontFamily: 'Manrope',
        fontSize: '14px',
        color: '#D6D9E4',
        align: 'center',
        lineSpacing: 6,
        wordWrap: { width: ANCHO_TARJETA_MAX - PADDING_TARJETA * 2 },
      })
      .setOrigin(0.5);

    this.dibujarTarjeta();
    this.cargarNarracion();
  }

  // dibujarTarjeta recalcula la geometría completa de la tarjeta en base al
  // alto real de los textos (que cambia al llegar la narración) y a la
  // cantidad de opciones, y reposiciona badge/título/narración/separador.
  dibujarTarjeta() {
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    this.cx = anchoPantalla / 2;
    this.cy = altoPantalla / 2;
    this.anchoTarjeta = Math.min(anchoPantalla - 80, ANCHO_TARJETA_MAX);
    this.anchoInterno = this.anchoTarjeta - PADDING_TARJETA * 2;

    this.textoTitulo.setWordWrapWidth(this.anchoInterno);
    this.textoEvento.setWordWrapWidth(this.anchoInterno);

    const cantidadOpciones = this.eventDetails.options?.length ?? 0;
    const altoBotones = cantidadOpciones
      ? cantidadOpciones * ALTO_BOTON + (cantidadOpciones - 1) * GAP_BOTONES
      : 0;

    const altoContenido =
      PADDING_TARJETA +
      this.badgeTipo.height +
      GAP_BAJO_BADGE +
      this.textoTitulo.height +
      GAP_BAJO_TITULO +
      this.textoEvento.height +
      GAP_BAJO_NARRACION +
      (cantidadOpciones ? 1 + ESPACIO_SEPARADOR_BOTONES : 0) +
      altoBotones +
      PADDING_TARJETA;

    const altoTarjeta = Phaser.Math.Clamp(altoContenido, 280, altoPantalla - 100);
    this.altoTarjeta = altoTarjeta;

    const xIzq = this.cx - this.anchoTarjeta / 2;
    const yTop = this.cy - altoTarjeta / 2;

    // Fondo oscuro sólido tipo #1a1a2e + borde de 3px del color del tipo.
    this.graphicsTarjeta.clear();
    this.graphicsTarjeta.fillStyle(0x1a1a2e, 1);
    this.graphicsTarjeta.fillRoundedRect(xIzq, yTop, this.anchoTarjeta, altoTarjeta, RADIO_TARJETA);
    this.graphicsTarjeta.lineStyle(3, this.tipoEvento.colorBorde, 1);
    this.graphicsTarjeta.strokeRoundedRect(xIzq, yTop, this.anchoTarjeta, altoTarjeta, RADIO_TARJETA);

    // Posicionamiento vertical secuencial del contenido.
    let cursorY = yTop + PADDING_TARJETA;

    this.badgeTipo.setPosition(this.cx, cursorY + this.badgeTipo.height / 2);
    cursorY += this.badgeTipo.height + GAP_BAJO_BADGE;

    this.textoTitulo.setPosition(this.cx, cursorY + this.textoTitulo.height / 2);
    cursorY += this.textoTitulo.height + GAP_BAJO_TITULO;

    this.textoEvento.setPosition(this.cx, cursorY + this.textoEvento.height / 2);
    cursorY += this.textoEvento.height + GAP_BAJO_NARRACION;

    // Separador visual antes de los botones.
    this.graphicsSeparador.clear();
    if (cantidadOpciones) {
      this.graphicsSeparador.fillStyle(0x2e2e4a, 1);
      this.graphicsSeparador.fillRoundedRect(
        this.cx - this.anchoInterno / 2,
        cursorY,
        this.anchoInterno,
        1,
        1
      );
      cursorY += ESPACIO_SEPARADOR_BOTONES;
    }

    this.yBotones = cursorY;

    // Si los botones ya existían (re-dibujo), los reposiciono.
    this.botones.forEach((boton, indice) => {
      boton.setPosition(this.cx, this.yBotones + ALTO_BOTON / 2 + indice * (ALTO_BOTON + GAP_BOTONES));
    });
  }

  crearBotones() {
    const anchoBoton = this.anchoInterno;

    this.eventDetails.options.forEach((option, indice) => {
      const y = this.yBotones + ALTO_BOTON / 2 + indice * (ALTO_BOTON + GAP_BOTONES);
      const colores = inferirColorOpcion(option);

      const cont = this.add.container(this.cx, y);

      const fondo = this.add.graphics();
      const etiqueta = this.add
        .text(0, 0, option.label, {
          fontFamily: 'Manrope',
          fontSize: '15px',
          fontStyle: 'bold',
          color: colores.texto,
          align: 'center',
          wordWrap: { width: anchoBoton - 32 },
        })
        .setOrigin(0.5);

      const dibujarFondo = (coloresActivos) => {
        fondo.clear();
        fondo.fillStyle(coloresActivos.fondo, 1);
        fondo.fillRoundedRect(-anchoBoton / 2, -ALTO_BOTON / 2, anchoBoton, ALTO_BOTON, 10);
        fondo.lineStyle(2, coloresActivos.borde, 1);
        fondo.strokeRoundedRect(-anchoBoton / 2, -ALTO_BOTON / 2, anchoBoton, ALTO_BOTON, 10);
      };
      dibujarFondo(colores);

      cont.add([fondo, etiqueta]);

      // Hit area centrado en el container (coordenadas locales).
      cont.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-anchoBoton / 2, -ALTO_BOTON / 2, anchoBoton, ALTO_BOTON),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });

      // Hover: leve scale up (1.03) + fondo aclarado. Al salir, vuelve a
      // escala 1 y a los colores originales.
      cont.on('pointerover', () => {
        if (this.resolviendo) return;
        cont.setScale(1.03);
        dibujarFondo({
          fondo: aclararColorHex(colores.fondo),
          borde: aclararColorHex(colores.borde),
          texto: colores.texto,
        });
      });

      cont.on('pointerout', () => {
        if (this.resolviendo) return;
        cont.setScale(1);
        dibujarFondo(colores);
      });

      cont.on('pointerdown', () => this.manejarClickOpcion(option, cont));

      this.botones.push(cont);
    });
  }

  // generarNarracionLocal arma un mock string de narración a partir del
  // evento y del careerState en memoria, para los casos donde no hay un
  // runtime que sirva /api/narrar-evento (ver cargarNarracion). No reemplaza
  // la narración real de Gemini: es un respaldo local para no depender del
  // (inexistente) endpoint en desarrollo.
  generarNarracionLocal() {
    const { pressure, streak } = careerState.getState();
    const contexto = [];

    if (pressure >= 70) contexto.push('la presión está alta');
    if (streak >= 3) contexto.push(`llevan ${streak} victorias al hilo`);
    else if (streak <= -2) contexto.push(`vienen de ${Math.abs(streak)} derrotas seguidas`);

    const contextoTexto = contexto.length ? ` El equipo llega con ${contexto.join(' y ')}.` : '';

    return `${this.eventDetails.titulo}: ${this.eventDetails.descripcion}${contextoTexto}`;
  }

  // cargarNarracion le pide a api/narrar-evento.js una versión narrada de la
  // descripción del evento. Si el fetch falla o tarda más que
  // NARRAR_EVENTO_TIMEOUT_MS (el endpoint ya se autolimita a ~2.5s del lado
  // de Gemini, este timeout es una red de seguridad extra por si la propia
  // request de red se cuelga), usamos la descripción original del catálogo:
  // el juego nunca debe quedarse trabado esperando a la IA.
  //
  // OJO con el entorno: /api/narrar-evento solo existe como función serverless
  // en el deploy de Vercel. En desarrollo (Vite) el dev server no ejecuta
  // ese runtime y responde 404, que ensucia la consola y hace una request
  // inútil. Por eso en DEV (o sin Vite) nos saltamos el fetch entero y
  // generamos la narración localmente; en producción (Vite build, donde
  // import.meta.env.DEV es false) el endpoint sí existe y se usa normal.
  async cargarNarracion() {
    const esDesarrollo = import.meta.env?.DEV !== false;
    if (esDesarrollo) {
      this.mostrarOpciones(this.generarNarracionLocal());
      return;
    }

    let narracion = this.eventDetails.descripcion;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NARRAR_EVENTO_TIMEOUT_MS);

    try {
      const response = await fetch(NARRAR_EVENTO_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          eventDetails: this.eventDetails,
          careerStateSnapshot: careerState.getState(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (typeof data?.narracion === 'string' && data.narracion.trim().length > 0) {
          narracion = data.narracion;
        }
      }
    } catch (error) {
      logger.error('EventScene: fallo al pedir narración, usando descripción base:', error.message);
    } finally {
      clearTimeout(timeoutId);
    }

    // La escena pudo haberse cerrado mientras esperábamos la respuesta (por
    // ejemplo, si el jugador cierra el juego): no toquemos objetos de una
    // escena ya destruida.
    if (!this.scene.isActive()) return;

    this.mostrarOpciones(narracion);
  }

  mostrarOpciones(narracion) {
    this.textoEvento.setText(narracion);
    this.dibujarTarjeta();
    this.crearBotones();
  }

  // manejarClickOpcion muestra el feedback flotante de option.effects, bloquea
  // los demás botones mientras dura la animación, y recién cuando termina
  // TODOS los tweens llama a this.onResolve(option) (con la opción COMPLETA)
  // y cierra la escena con this.scene.stop().
  manejarClickOpcion(option, boton) {
    if (this.resolviendo) return;
    this.resolviendo = true;

    const effects = option?.effects && typeof option.effects === 'object' ? option.effects : {};
    const efectosNumericos = Object.entries(effects).filter(
      ([, valor]) => typeof valor === 'number' && !Number.isNaN(valor)
    );

    // Sin deltas numéricos no hay nada que mostrar: resolvemos directo.
    if (efectosNumericos.length === 0) {
      this.onResolve(option);
      this.scene.stop();
      return;
    }

    // Bloquear el resto de los botones (evita doble click / otra opción
    // mientras se muestra el feedback).
    this.botones.forEach((b) => b.disableInteractive());

    let pendientes = efectosNumericos.length;

    efectosNumericos.forEach(([clave, valor], indice) => {
      const positivo = valor >= 0;

      const textoFeedback = this.add
        .text(boton.x, boton.y, formatearEfecto(clave, valor), {
          fontFamily: 'Manrope',
          fontSize: '16px',
          fontStyle: 'bold',
          color: positivo ? '#4ADE80' : '#F87171',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(20);

      this.tweens.add({
        targets: textoFeedback,
        alpha: 0,
        y: boton.y - 30,
        duration: 800,
        delay: indice * 70,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          textoFeedback.destroy();
          pendientes -= 1;

          if (pendientes === 0) {
            // Pasamos la opción COMPLETA (no solo el id): aplicarDecisionYContinuar
            // en seasonOrchestrator.js lee decisionElegida.effects para aplicar los
            // deltas del evento.
            this.onResolve(option);
            this.scene.stop();
          }
        },
      });
    });
  }
}
