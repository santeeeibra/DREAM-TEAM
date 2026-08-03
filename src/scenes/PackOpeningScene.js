// PackOpeningScene.js — la animación de apertura de los 5 sobres.
// Recibe los sobres YA armados y guardados en la base (ver openPacks.js);
// esta escena solo se encarga de la parte visual: mostrar "Sobre X de 5",
// y al tocar la pantalla ir revelando carta por carta con su foto y rating.
import Phaser from 'phaser';
import { RevealCardSprite, CARD_WIDTH, CARD_HEIGHT, claveImagenCarta } from '../objects/RevealCardSprite.js';
import { claveAvatarIniciales, generateInitialsAvatarDataURI } from '../utils/initialsAvatar.js';
import { resolveCardImageUrl } from '../utils/cardImage.js';
import * as logger from '../core/logger.js';

export class PackOpeningScene extends Phaser.Scene {
  constructor() {
    super('PackOpeningScene');
  }

  // data = { packs: [ [5 cartas], [5 cartas], ... 5 sobres ], onFinish? }
  // onFinish es un callback opcional que se llama cuando el jugador toca
  // "Armar mi 11" en el resumen final (ver mostrarResumenFinal). Lo maneja
  // main.js, que es quien sabe cómo pasar a LineupScene.
  init(data) {
    this.packs = data.packs;
    this.onFinish = data.onFinish;
    this.packIndex = 0;
    this.cardIndexInPack = -1; // -1 = todavía no se abrió el sobre actual
    this.currentCardSprite = null;
  }

  // Encolamos la descarga de todas las fotos ANTES de arrancar la
  // animación. Si una foto no existe o no carga, RevealCardSprite cae
  // solo a un ícono de color (no rompe la apertura del sobre).
  preload() {
    const todasLasCartas = this.packs.flat();
    for (const carta of todasLasCartas) {
      const urlImagen = resolveCardImageUrl(carta);
      if (urlImagen) {
        this.load.image(claveImagenCarta(carta.id), urlImagen);
      }
      // El avatar de iniciales se encola SIEMPRE, aunque la carta tenga
      // foto: si fut.gg tira 404, el loaderror se dispara, la textura de
      // la foto nunca existe, y RevealCardSprite necesita encontrar las
      // iniciales ya cargadas en ese momento.
      const claveIniciales = claveAvatarIniciales(carta.id);
      if (!this.textures.exists(claveIniciales)) {
        this.load.image(
          claveIniciales,
          generateInitialsAvatarDataURI(carta.name, carta.overall_rating)
        );
      }
    }
    this.load.on('loaderror', (file) => {
      logger.warn('No se pudo cargar la foto:', file.key);
    });
  }

  create() {
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;
    this.centroX = anchoPantalla / 2;
    this.centroY = altoPantalla / 2 - 20;

    this.titulo = this.add
      .text(this.centroX, 60, '', { fontFamily: 'Arial', fontSize: '24px', color: '#ffffff' })
      .setOrigin(0.5);

    this.instruccion = this.add
      .text(this.centroX, altoPantalla - 50, '', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#cccccc',
      })
      .setOrigin(0.5);

    // Rectángulo invisible que cubre toda la pantalla: tocar en cualquier
    // lado avanza al siguiente paso (abrir sobre / revelar carta / seguir).
    this.zonaClick = this.add.rectangle(this.centroX, altoPantalla / 2, anchoPantalla, altoPantalla, 0x000000, 0);
    this.zonaClick.setInteractive({ useHandCursor: true });
    this.zonaClick.on('pointerdown', () => this.avanzar());

    this.mostrarIntroSobre();
  }

  // Pantalla "Sobre X de 5, tocá para abrir" (sin cartas visibles todavía).
  mostrarIntroSobre() {
    this.cardIndexInPack = -1;
    this.limpiarCartaActual();

    this.titulo.setText(`Sobre ${this.packIndex + 1} de ${this.packs.length}`);
    this.instruccion.setText('Tocá la pantalla para abrir el sobre');

    const sobre = this.add.rectangle(this.centroX, this.centroY, CARD_WIDTH, CARD_HEIGHT, 0x1e2a4a);
    sobre.setStrokeStyle(4, 0xd4af37);
    const sello = this.add
      .text(this.centroX, this.centroY, '5\ncartas', {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#d4af37',
        align: 'center',
      })
      .setOrigin(0.5);

    this.grupoSobreCerrado = this.add.container(0, 0, [sobre, sello]);
    this.tweens.add({
      targets: this.grupoSobreCerrado,
      scale: { from: 0.95, to: 1.05 },
      duration: 650,
      yoyo: true,
      repeat: -1,
    });
  }

  // Dibuja la carta actual (this.packIndex / this.cardIndexInPack) con una
  // animación simple de aparición.
  mostrarCartaActual() {
    this.limpiarCartaActual();

    const carta = this.packs[this.packIndex][this.cardIndexInPack];
    this.currentCardSprite = new RevealCardSprite(this, this.centroX, this.centroY, carta);
    this.currentCardSprite.setScale(0);

    this.tweens.add({
      targets: this.currentCardSprite,
      scale: 1,
      duration: 350,
      ease: 'Back.Out',
    });

    this.titulo.setText(`Sobre ${this.packIndex + 1} de ${this.packs.length} — carta ${this.cardIndexInPack + 1} de 5`);

    const esUltimaDelSobre = this.cardIndexInPack === this.packs[this.packIndex].length - 1;
    const esUltimoSobre = this.packIndex === this.packs.length - 1;
    if (esUltimaDelSobre && esUltimoSobre) {
      this.instruccion.setText('Tocá para ver el resumen de tu plantel');
    } else if (esUltimaDelSobre) {
      this.instruccion.setText('Tocá para ir al siguiente sobre');
    } else {
      this.instruccion.setText('Tocá para revelar la siguiente carta');
    }
  }

  limpiarCartaActual() {
    if (this.currentCardSprite) {
      this.currentCardSprite.destroy();
      this.currentCardSprite = null;
    }
    if (this.grupoSobreCerrado) {
      this.grupoSobreCerrado.destroy();
      this.grupoSobreCerrado = null;
    }
  }

  // Un solo botón hace todo el trabajo: abrir el sobre, revelar la
  // siguiente carta, pasar al siguiente sobre, o mostrar el resumen final.
  avanzar() {
    const sobreActual = this.packs[this.packIndex];

    if (this.cardIndexInPack === -1) {
      this.cardIndexInPack = 0;
      this.mostrarCartaActual();
      return;
    }

    if (this.cardIndexInPack < sobreActual.length - 1) {
      this.cardIndexInPack += 1;
      this.mostrarCartaActual();
      return;
    }

    if (this.packIndex < this.packs.length - 1) {
      this.packIndex += 1;
      this.mostrarIntroSobre();
      return;
    }

    this.mostrarResumenFinal();
  }

  mostrarResumenFinal() {
    this.limpiarCartaActual();
    this.zonaClick.disableInteractive();

    const plantel = this.packs.flat();
    const conteoPorPosicion = plantel.reduce((acc, carta) => {
      acc[carta.position] = (acc[carta.position] ?? 0) + 1;
      return acc;
    }, {});

    logger.log('Plantel completo (25 cartas):', plantel);

    this.titulo.setText('¡Tu plantel de 25 jugadores está listo!');
    this.instruccion.setText('');

    this.add
      .text(
        this.centroX,
        this.centroY,
        `POR: ${conteoPorPosicion.POR ?? 0}   DEF: ${conteoPorPosicion.DEF ?? 0}\nMED: ${conteoPorPosicion.MED ?? 0}   DEL: ${conteoPorPosicion.DEL ?? 0}\n\n(el plantel completo quedó impreso\nen la consola del navegador)`,
        { fontFamily: 'Arial', fontSize: '18px', color: '#ffffff', align: 'center' }
      )
      .setOrigin(0.5);

    if (this.onFinish) {
      const botonArmarOnce = this.add
        .text(this.centroX, this.centroY + 110, 'Armar mi 11 →', {
          fontFamily: 'Arial',
          fontSize: '18px',
          color: '#1a1a2e',
          backgroundColor: '#d4af37',
          padding: { x: 18, y: 10 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      botonArmarOnce.on('pointerdown', () => {
        botonArmarOnce.disableInteractive();
        botonArmarOnce.setText('Cargando...');
        this.onFinish();
      });
    }
  }
}
