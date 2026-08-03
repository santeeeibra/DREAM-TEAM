// EventScene.js — overlay placeholder para mostrar un evento de temporada y
// dejar que el jugador elija una opción.
//
// Se lanza con scene.launch (no scene.start) sobre SeasonScene, así queda
// dibujada encima sin destruir la escena de fondo. Al elegir una opción se
// llama a onResolve(option.id) y se cierra el overlay con scene.stop().
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

const NARRAR_EVENTO_ENDPOINT = '/api/narrar-evento';
const NARRAR_EVENTO_TIMEOUT_MS = 4000;

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

    this.add.rectangle(anchoPantalla / 2, altoPantalla / 2, anchoPantalla, altoPantalla, 0x000000, 0.75);

    this.add
      .text(anchoPantalla / 2, altoPantalla / 2 - 140, this.eventDetails.titulo, {
        fontFamily: 'Arial',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#d4af37',
        align: 'center',
        wordWrap: { width: anchoPantalla - 80 },
      })
      .setOrigin(0.5);

    this.textoEvento = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 - 80, 'Analizando la situación con el cuerpo técnico...', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: anchoPantalla - 80 },
      })
      .setOrigin(0.5);

    this.cargarNarracion();
  }

  // cargarNarracion le pide a api/narrar-evento.js una versión narrada de la
  // descripción del evento. Si el fetch falla o tarda más que
  // NARRAR_EVENTO_TIMEOUT_MS (el endpoint ya se autolimita a ~2.5s del lado
  // de Gemini, este timeout es una red de seguridad extra por si la propia
  // request de red se cuelga), usamos la descripción original del catálogo:
  // el juego nunca debe quedarse trabado esperando a la IA.
  async cargarNarracion() {
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
      console.error('EventScene: fallo al pedir narración, usando descripción base:', error.message);
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

    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;
    const posicionInicialY = altoPantalla / 2;
    const espacioEntreBotones = 50;

    this.eventDetails.options.forEach((option, indice) => {
      const boton = this.add
        .text(anchoPantalla / 2, posicionInicialY + indice * espacioEntreBotones, option.label, {
          fontFamily: 'Arial',
          fontSize: '15px',
          color: '#1a1a2e',
          backgroundColor: '#d4af37',
          padding: { x: 16, y: 10 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      boton.on('pointerdown', () => {
        // Pasamos la opción COMPLETA (no solo el id): aplicarDecisionYContinuar
        // en seasonOrchestrator.js lee decisionElegida.effects para aplicar los
        // deltas del evento.
        this.onResolve(option);
        this.scene.stop();
      });
    });
  }
}
