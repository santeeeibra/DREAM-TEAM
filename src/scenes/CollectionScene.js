// CollectionScene.js — escena que muestra la "colección" real de cartas del
// manager logueado: una grilla de 4 columnas con las cartas que trae
// getManagerCards (join user_cards + cards en Supabase), y scroll vertical
// (con la rueda del mouse) por si hay más cartas de las que entran en pantalla.

import Phaser from 'phaser';
import { CardSprite, CARD_WIDTH, CARD_HEIGHT, claveFotoCarta } from '../objects/CardSprite.js';
import { claveAvatarGenerico, generatePlayerAvatarDataURI } from '../utils/avatarGenerator.js';

// Cuántas columnas tiene la grilla y cuánto espacio dejamos entre carta y carta.
const COLUMNAS = 4;
const ESPACIO = 20; // gap horizontal y vertical entre cartas
const MARGEN_SUPERIOR = 24; // separación entre el borde de arriba de la pantalla y la primera fila

export class CollectionScene extends Phaser.Scene {
  constructor() {
    // 'CollectionScene' es el nombre con el que Phaser identifica esta escena
    super('CollectionScene');
  }

  // data = { managerId, cards } — cards son las cartas reales del manager
  // (ver getManagerCards en src/lineups.js), ya resueltas por quien arranca
  // la escena (LineupScene al volver, o el panel de dev), mismo patrón que
  // usan PackOpeningScene/LineupScene con sus propios datos.
  init(data) {
    this.managerId = data.managerId;
    this.cards = data.cards;
  }

  // Encolamos la foto real de cada carta (si tiene photo_url) y, para
  // todas, el avatar genérico de Dicebear como respaldo — así
  // dibujarIconoAvatar() en CardSprite.js siempre tiene algo mejor que un
  // círculo de color para mostrar, sin importar si la Tarea de fotos reales
  // ya corrió para ese jugador o no.
  preload() {
    for (const carta of this.cards) {
      if (carta.photo_url && !this.textures.exists(claveFotoCarta(carta.id))) {
        this.load.image(claveFotoCarta(carta.id), carta.photo_url);
      }
      const claveAvatar = claveAvatarGenerico(carta.id);
      if (!this.textures.exists(claveAvatar)) {
        this.load.image(claveAvatar, generatePlayerAvatarDataURI(carta.id));
      }
    }
    this.load.on('loaderror', (file) => {
      console.warn('No se pudo cargar la imagen de la carta:', file.key);
    });
  }

  create() {
    console.log('CollectionScene create() ejecutado');
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    // Un Container vacío que va a actuar como "bandeja" de todas las cartas.
    // La idea de meter todas las cartas dentro de un único container es que,
    // para hacer scroll, alcanza con mover este único objeto en Y en vez de
    // mover carta por carta.
    this.gridContainer = this.add.container(0, 0);

    // Calculamos cuánto mide el ancho total de la grilla (4 cartas + los espacios
    // entre ellas), para poder centrarla horizontalmente en la pantalla.
    const anchoGrilla = COLUMNAS * CARD_WIDTH + (COLUMNAS - 1) * ESPACIO;
    const offsetX = (anchoPantalla - anchoGrilla) / 2;

    // Recorremos cada carta real del manager y calculamos en qué fila/columna
    // le toca dibujarse.
    this.cards.forEach((cardData, indice) => {
      const columna = indice % COLUMNAS;
      const fila = Math.floor(indice / COLUMNAS);

      // CardSprite se posiciona por su CENTRO, por eso sumamos la mitad del
      // ancho/alto de la carta al ir calculando cada posición.
      const x = offsetX + columna * (CARD_WIDTH + ESPACIO) + CARD_WIDTH / 2;
      const y = MARGEN_SUPERIOR + fila * (CARD_HEIGHT + ESPACIO) + CARD_HEIGHT / 2;

      const carta = new CardSprite(this, x, y, cardData);

      // La sacamos de la raíz de la escena y la metemos dentro de gridContainer,
      // así se mueve junto con el resto de la grilla cuando hagamos scroll.
      this.gridContainer.add(carta);
    });

    // Cuántas filas se generaron en total, para saber el alto real de todo el contenido.
    const filasTotales = Math.ceil(this.cards.length / COLUMNAS);
    const altoContenido =
      MARGEN_SUPERIOR + filasTotales * CARD_HEIGHT + (filasTotales - 1) * ESPACIO + MARGEN_SUPERIOR;

    // Si el contenido entra completo en la pantalla, no hace falta scroll (queda en 0).
    // Si no entra, calculamos cuánto es el máximo que se puede "subir" la grilla
    // para llegar a ver la última fila (será un número negativo).
    this.scrollMinY = Math.min(0, altoPantalla - altoContenido);
    this.scrollMaxY = 0;

    this.habilitarScroll();
  }

  // Permite mover la grilla hacia arriba/abajo girando la rueda del mouse,
  // sin salirse nunca del rango [scrollMinY, scrollMaxY] calculado en create().
  habilitarScroll() {
    this.input.on('wheel', (_pointer, _gameObjects, _deltaX, deltaY) => {
      // deltaY positivo = rueda hacia abajo (queremos subir el contenido, restar).
      const nuevaY = this.gridContainer.y - deltaY;

      // Phaser.Math.Clamp obliga a que el valor quede siempre dentro del rango indicado,
      // así la grilla nunca se puede arrastrar más allá del principio o del final.
      this.gridContainer.y = Phaser.Math.Clamp(nuevaY, this.scrollMinY, this.scrollMaxY);
    });
  }
}
