// CareerTimelineScene.js — línea de tiempo de la carrera: una fila por
// temporada (1 a totalSeasons), mostrando el rating snapshot y el club de
// las ya jugadas/en curso, y un placeholder atenuado para las futuras.
// Todo el cálculo de qué mostrar en cada fila vive en careerTimeline.js
// (buildTimelineRows); esta escena solo dibuja lo que esa función devuelve.
import Phaser from 'phaser';
import { buildTimelineRows } from '../careerTimeline.js';

// Franja fija de arriba (título) y de abajo (botón volver), mismo criterio
// que CollectionScene/LineupScene: solo el contenido del medio (listaContainer)
// se mueve con el scroll.
const ALTO_HEADER = 70;
const ALTO_FOOTER = 90;
const MARGEN_SUPERIOR = 16;
const ALTO_FILA = 60;
const ESPACIO_FILA = 10;

export class CareerTimelineScene extends Phaser.Scene {
  constructor() {
    super('CareerTimelineScene');
  }

  // data = { managerId, seasons, currentSeasonNumber, totalSeasons, cards? }
  // seasons ya viene traído de Supabase por quien arranca esta escena (ver
  // irAPantalla() en devActions.js): esta escena no habla con la base.
  init(data) {
    this.managerId = data.managerId;
    this.seasons = data.seasons;
    this.currentSeasonNumber = data.currentSeasonNumber;
    this.totalSeasons = data.totalSeasons;
    this.cards = data.cards ?? null;
  }

  create() {
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    this.add.rectangle(anchoPantalla / 2, altoPantalla / 2, anchoPantalla, altoPantalla, 0x1a1a2e);

    this.crearHeader(anchoPantalla);
    this.crearLista(anchoPantalla, altoPantalla);
    this.crearBotonVolver(anchoPantalla, altoPantalla);
  }

  crearHeader(anchoPantalla) {
    this.add.rectangle(anchoPantalla / 2, ALTO_HEADER / 2, anchoPantalla, ALTO_HEADER, 0x1a1a2e).setDepth(10);
    this.add
      .rectangle(anchoPantalla / 2, ALTO_HEADER, anchoPantalla, 2, 0xd4af37)
      .setOrigin(0.5, 0)
      .setDepth(10);

    this.add
      .text(anchoPantalla / 2, ALTO_HEADER / 2, 'Mi carrera', {
        fontFamily: 'Arial',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#d4af37',
      })
      .setOrigin(0.5)
      .setDepth(11);
  }

  // Lista scrolleable (mismo patrón de máscara + scroll que la grilla de
  // LineupScene): listaContainer se mueve con la rueda del mouse, recortado
  // a la franja entre el header y el footer fijos.
  crearLista(anchoPantalla, altoPantalla) {
    this.listaContainer = this.add.container(0, ALTO_HEADER);

    const altoVisible = altoPantalla - ALTO_HEADER - ALTO_FOOTER;
    const formaMascara = this.make.graphics({ add: false });
    formaMascara.fillRect(0, ALTO_HEADER, anchoPantalla, altoVisible);
    this.listaContainer.setMask(formaMascara.createGeometryMask());

    const filas = buildTimelineRows(this.seasons, this.currentSeasonNumber, this.totalSeasons);

    let y = MARGEN_SUPERIOR;
    for (const fila of filas) {
      this.dibujarFila(fila, y, anchoPantalla);
      y += ALTO_FILA + ESPACIO_FILA;
    }

    const altoContenido = y;
    this.scrollMinY = Math.min(0, altoVisible - altoContenido);
    this.scrollMaxY = 0;
    this.habilitarScroll();
  }

  dibujarFila(fila, y, anchoPantalla) {
    if (fila.state === 'future') {
      this.dibujarFilaFutura(fila, y, anchoPantalla);
      return;
    }
    this.dibujarFilaJugada(fila, y, anchoPantalla);
  }

  dibujarFilaJugada(fila, y, anchoPantalla) {
    const fondo = this.add
      .rectangle(anchoPantalla / 2, y + ALTO_FILA / 2, anchoPantalla - 40, ALTO_FILA, 0x0f1626)
      .setStrokeStyle(1, 0x2a3550);

    const etiquetaTemporada = this.add
      .text(32, y + ALTO_FILA / 2, `T${fila.seasonNumber}`, {
        fontFamily: 'Arial',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#d4af37',
      })
      .setOrigin(0, 0.5);

    const partesDetalle = [];
    if (fila.rating != null) partesDetalle.push(`OVR ${fila.rating}`);
    if (fila.clubName) partesDetalle.push(fila.clubName);
    if (fila.state === 'current') partesDetalle.push('en curso');
    const textoDetalle = partesDetalle.length ? partesDetalle.join(' · ') : 'Sin datos todavía';

    const etiquetaDetalle = this.add
      .text(90, y + ALTO_FILA / 2, textoDetalle, {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5);

    this.listaContainer.add([fondo, etiquetaTemporada, etiquetaDetalle]);
  }

  // Temporada futura: fila gris/placeholder, sin datos, atenuada con alpha
  // bajo para que se lea de un vistazo que todavía no se jugó.
  dibujarFilaFutura(fila, y, anchoPantalla) {
    const contenedorFila = this.add.container(0, 0).setAlpha(0.35);

    const fondo = this.add
      .rectangle(anchoPantalla / 2, y + ALTO_FILA / 2, anchoPantalla - 40, ALTO_FILA, 0x0f1626)
      .setStrokeStyle(1, 0x2a3550);

    const etiquetaTemporada = this.add
      .text(32, y + ALTO_FILA / 2, `T${fila.seasonNumber}`, {
        fontFamily: 'Arial',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#9aa5b8',
      })
      .setOrigin(0, 0.5);

    const etiquetaDetalle = this.add
      .text(90, y + ALTO_FILA / 2, 'Todavía no juega', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#9aa5b8',
      })
      .setOrigin(0, 0.5);

    contenedorFila.add([fondo, etiquetaTemporada, etiquetaDetalle]);
    this.listaContainer.add(contenedorFila);
  }

  habilitarScroll() {
    this.input.on('wheel', (_pointer, _gameObjects, _deltaX, deltaY) => {
      const nuevaOffset = this.listaContainer.y - ALTO_HEADER - deltaY;
      const offsetClamp = Phaser.Math.Clamp(nuevaOffset, this.scrollMinY, this.scrollMaxY);
      this.listaContainer.y = ALTO_HEADER + offsetClamp;
    });
  }

  crearBotonVolver(anchoPantalla, altoPantalla) {
    const yFooter = altoPantalla - ALTO_FOOTER;
    this.add.rectangle(anchoPantalla / 2, yFooter + ALTO_FOOTER / 2, anchoPantalla, ALTO_FOOTER, 0x0f1626, 0.97);
    this.add.rectangle(anchoPantalla / 2, yFooter, anchoPantalla, 2, 0xd4af37, 0.6);

    const boton = this.add
      .text(anchoPantalla / 2, yFooter + ALTO_FOOTER / 2, 'Volver', {
        fontFamily: 'Arial',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#1a1a2e',
        backgroundColor: '#d4af37',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    boton.on('pointerdown', () => {
      if (this.cards) {
        this.scene.start('CollectionScene', { managerId: this.managerId, cards: this.cards });
      } else {
        this.scene.start('CollectionScene', { managerId: this.managerId });
      }
    });
  }
}
