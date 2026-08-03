Revisar el evento del botón verde en CollectionScene.js:
Busca dónde se registra el evento pointerdown o click de ese botón superior derecho (Alinear Equipo). Actualmente debe estar haciendo algo como:

JavaScript
// Código actual erróneo (te manda a armar el 11)
this.scene.start('LineupScene', { managerId, cards });
Redirigirlo a la simulación:
Ese botón debería verificar que el once esté completo o directamente iniciar la escena de partidos/simulación de la temporada:

JavaScript
// Código correcto deseado
this.scene.start('SimulationScene', { managerId }); // o el nombre de tu escena de te// CollectionScene.js — escena "MI DREAM TEAM": muestra la colección real de
// cartas del manager logueado en una grilla de 4 columnas (getManagerCards,
// join user_cards + cards en Supabase), con scroll vertical (rueda del
// mouse) por si hay más cartas de las que entran en pantalla.
//
// Se llega acá desde LineupScene, tocando "Volver a mi Dream Team" después
// de guardar el 11 titular. Desde acá se puede volver a LineupScene para
// re-armar el 11 (por ejemplo si cambió el plantel tras abrir más sobres).

import Phaser from 'phaser';
import { CardSprite, CARD_WIDTH, CARD_HEIGHT, claveFotoCarta } from '../objects/CardSprite.js';
import { claveAvatarIniciales, generateInitialsAvatarDataURI } from '../utils/initialsAvatar.js';
import { resolveCardImageUrl } from '../utils/cardImage.js';

const COLUMNAS = 4;
const ESPACIO = 20;

// Franja fija de arriba (título + contador + botón), NO se mueve con el
// scroll. Solo gridContainer se mueve; el header queda siempre visible.
const ALTO_HEADER = 70;
const MARGEN_SUPERIOR = 24;

export class CollectionScene extends Phaser.Scene {
  constructor() {
    super('CollectionScene');
  }

  init(data) {
    this.managerId = data.managerId;
    // Filtro defensivo: solo cartas con foto real. Los jugadores con
    // photo_url null/undefined/vacío no se muestran (evita fallos al
    // cargar texturas y mantiene la grilla/contador consistentes).
    this.cards = (data.cards ?? []).filter(
      (carta) => carta.photo_url && carta.photo_url.trim() !== ''
    );
  }

  preload() {
    for (const carta of this.cards) {
      const urlImagen = resolveCardImageUrl(carta);
      if (urlImagen && !this.textures.exists(claveFotoCarta(carta.id))) {
        this.load.image(claveFotoCarta(carta.id), urlImagen);
      }
      // El avatar de iniciales se encola SIEMPRE, aunque la carta tenga
      // foto: si fut.gg tira 404, el loaderror se dispara, la textura de
      // la foto nunca existe, y el sprite necesita encontrar las iniciales
      // ya cargadas en ese momento.
      const claveIniciales = claveAvatarIniciales(carta.id);
      if (!this.textures.exists(claveIniciales)) {
        this.load.image(
          claveIniciales,
          generateInitialsAvatarDataURI(carta.name, carta.overall_rating)
        );
      }
    }
    this.load.on('loaderror', (file) => {
      console.warn('No se pudo cargar la imagen de la carta:', file.key);
    });
  }

  create() {
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;
    this.crearHeader(anchoPantalla);
    this.crearGrilla(anchoPantalla, altoPantalla);
    this.habilitarScroll();
  }

  crearHeader(anchoPantalla) {
    this.add.rectangle(anchoPantalla / 2, ALTO_HEADER / 2, anchoPantalla, ALTO_HEADER, 0x1a1a2e).setDepth(10);

    this.add
      .text(anchoPantalla / 2, 18, 'MI DREAM TEAM', {
        fontFamily: 'Arial', fontSize: '24px', fontStyle: 'bold', color: '#d4af37',
      })
      .setOrigin(0.5, 0).setDepth(11);

    this.add
      .text(anchoPantalla / 2, 46, `${this.cards.length} cartas`, {
        fontFamily: 'Arial', fontSize: '13px', color: '#aaaaaa',
      })
      .setOrigin(0.5, 0).setDepth(11);

    const botonVolver = this.add
      .text(16, ALTO_HEADER / 2, '◀ Armar mi 11', {
        fontFamily: 'Arial', fontSize: '14px', color: '#1a1a2e',
        backgroundColor: '#d4af37', padding: { x: 10, y: 6 },
      })
      .setOrigin(0, 0.5).setDepth(11)
      .setInteractive({ useHandCursor: true });

    botonVolver.on('pointerdown', () => {
      this.scene.start('LineupScene', { managerId: this.managerId, cards: this.cards });
    });

    // Botón "Alinear Equipo": acceso directo a la simulación de temporada
    // (SeasonScene) desde la colección. SeasonScene se encarga de cargar el
    // 11 titular y validar que esté completo internamente.
    const botonAlinear = this.add
      .text(anchoPantalla - 16, ALTO_HEADER / 2, 'Alinear Equipo ▶', {
        fontFamily: 'Arial', fontSize: '14px', color: '#1a1a2e',
        backgroundColor: '#2ecc71', padding: { x: 10, y: 6 },
      })
      .setOrigin(1, 0.5).setDepth(11)
      .setInteractive({ useHandCursor: true });

    botonAlinear.on('pointerdown', () => {
      this.scene.start('SeasonScene', { managerId: this.managerId });
    });
  }

  crearGrilla(anchoPantalla, altoPantalla) {
    this.gridContainer = this.add.container(0, ALTO_HEADER);

    const anchoGrilla = COLUMNAS * CARD_WIDTH + (COLUMNAS - 1) * ESPACIO;
    const offsetX = (anchoPantalla - anchoGrilla) / 2;

    this.cards.forEach((cardData, indice) => {
      const columna = indice % COLUMNAS;
      const fila = Math.floor(indice / COLUMNAS);
      const x = offsetX + columna * (CARD_WIDTH + ESPACIO) + CARD_WIDTH / 2;
      const y = MARGEN_SUPERIOR + fila * (CARD_HEIGHT + ESPACIO) + CARD_HEIGHT / 2;
      const carta = new CardSprite(this, x, y, cardData);
      this.gridContainer.add(carta);
    });

    const filasTotales = Math.ceil(this.cards.length / COLUMNAS);
    const altoContenido =
      MARGEN_SUPERIOR + filasTotales * CARD_HEIGHT + (filasTotales - 1) * ESPACIO + MARGEN_SUPERIOR;
    const altoDisponible = altoPantalla - ALTO_HEADER;

    this.scrollMinY = Math.min(0, altoDisponible - altoContenido);
    this.scrollMaxY = 0;
  }

  habilitarScroll() {
    this.input.on('wheel', (_pointer, _gameObjects, _deltaX, deltaY) => {
      const nuevaOffset = this.gridContainer.y - ALTO_HEADER - deltaY;
      const offsetClamp = Phaser.Math.Clamp(nuevaOffset, this.scrollMinY, this.scrollMaxY);
      this.gridContainer.y = ALTO_HEADER + offsetClamp;
    });
  }
}