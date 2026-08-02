// RevealCardSprite.js — la carta que se muestra durante la animación de
// apertura de sobres y en LineupScene. Es parecida a CardSprite.js (mismo
// tamaño, mismo estilo "escudo", misma paleta de bandas de rating y mismo
// placeholder de silueta), pero en vez de la foto/avatar de Dicebear usa
// solo la foto real del jugador (`cards.photo_url`) cuando está disponible.
import Phaser from 'phaser';
import { CARD_WIDTH, CARD_HEIGHT, dibujarSiluetaGenerica } from './CardSprite.js';
import { getTier } from '../shared/ratingTiers.js';
import { colorDeCarta } from '../shared/cardColors.js';

export { CARD_WIDTH, CARD_HEIGHT };

// Clave de textura que le corresponde a una carta si su foto llegó a
// cargarse bien (ver PackOpeningScene.preload()).
export function claveImagenCarta(cardId) {
  return `card-img-${cardId}`;
}

export class RevealCardSprite extends Phaser.GameObjects.Container {
  constructor(scene, x, y, cardData) {
    super(scene, x, y);
    this.cardData = cardData;

    this.dibujarFondoEscudo();
    this.dibujarFoto();
    this.dibujarRatingYPosicion();
    this.dibujarNombreYClub();

    scene.add.existing(this);
  }

  dibujarFondoEscudo() {
    const hw = CARD_WIDTH / 2;
    const hh = CARD_HEIGHT / 2;
    const corteArriba = 14;
    const corteAbajo = 34;

    const puntos = [
      { x: -hw + corteArriba, y: -hh },
      { x: hw - corteArriba, y: -hh },
      { x: hw, y: -hh + corteArriba },
      { x: hw, y: hh - corteAbajo },
      { x: hw - corteAbajo, y: hh },
      { x: -hw + corteAbajo, y: hh },
      { x: -hw, y: hh - corteAbajo },
      { x: -hw, y: -hh + corteArriba },
    ];

    const fondo = new Phaser.GameObjects.Graphics(this.scene);

    // La banda (Bronce/Plata/Oro/Especial) sale del overall_rating, igual
    // que en CardSprite.js — no de cards.rarity, que es un concepto de la
    // base totalmente distinto (probabilidad de drop en los sobres).
    // colorDeCarta (src/shared/cardColors.js) es la ÚNICA fuente de verdad
    // para el color de fondo: nunca hay que volver a leer cardData.rarity acá.
    const banda = getTier(this.cardData.overall_rating);
    const color = colorDeCarta(this.cardData);

    if (banda === 'SPECIAL') {
      fondo.fillGradientStyle(color.desde, color.desde, color.hasta, color.hasta, 1);
    } else {
      fondo.fillStyle(color, 1);
    }
    fondo.fillPoints(puntos, true);
    fondo.lineStyle(3, 0xffffff, 0.9);
    fondo.strokePoints(puntos, true);

    this.add(fondo);
  }

  // Si la textura de la foto llegó a cargarse (ver claveImagenCarta), la
  // dibuja centrada dentro de la carta. Si no, dibuja la misma silueta
  // genérica que usa CardSprite.js (no un círculo sólido de color).
  dibujarFoto() {
    const clave = claveImagenCarta(this.cardData.id);

    if (this.cardData.photo_url && this.scene.textures.exists(clave)) {
      const foto = new Phaser.GameObjects.Image(this.scene, 0, -6, clave);
      foto.setDisplaySize(88, 88);
      this.add(foto);
      return;
    }

    this.add(dibujarSiluetaGenerica(this.scene, 0, -10, 26));
  }

  dibujarRatingYPosicion() {
    const hw = CARD_WIDTH / 2;
    const hh = CARD_HEIGHT / 2;

    const textoRating = new Phaser.GameObjects.Text(
      this.scene,
      -hw + 12,
      -hh + 10,
      String(this.cardData.overall_rating),
      { fontFamily: 'Arial', fontSize: '26px', fontStyle: 'bold', color: '#ffffff' }
    );
    this.add(textoRating);

    const textoPosicion = new Phaser.GameObjects.Text(
      this.scene,
      -hw + 12,
      -hh + 38,
      this.cardData.position,
      { fontFamily: 'Arial', fontSize: '14px', color: '#ffffff' }
    );
    this.add(textoPosicion);
  }

  dibujarNombreYClub() {
    const hh = CARD_HEIGHT / 2;

    const nombre = new Phaser.GameObjects.Text(this.scene, 0, 26, this.cardData.name, {
      fontFamily: 'Arial',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: CARD_WIDTH - 16 },
    });
    nombre.setOrigin(0.5, 0);
    this.add(nombre);

    const club = new Phaser.GameObjects.Text(this.scene, 0, hh - 26, this.cardData.club ?? '', {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: '#dddddd',
      align: 'center',
    });
    club.setOrigin(0.5, 0);
    this.add(club);
  }
}
