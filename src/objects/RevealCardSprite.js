// RevealCardSprite.js — la carta que se muestra durante la animación de
// apertura de sobres. Es parecida a CardSprite.js (mismo tamaño, mismo
// estilo "escudo"), pero en vez de un ícono de color usa la foto real del
// jugador (`cards.photo_url`) cuando está disponible, y cae a un círculo
// de color como respaldo si esa carta todavía no tiene foto cargada.
import Phaser from 'phaser';
import { CARD_WIDTH, CARD_HEIGHT } from './CardSprite.js';

export { CARD_WIDTH, CARD_HEIGHT };

// Colores de fondo según `cards.rarity` (comun/rara/epica/legendaria),
// que es el campo real de la base — no confundir con las bandas
// bronze/silver/gold/special que usa CardSprite.js con datos mock.
const COLORES_RAREZA = {
  comun: 0x8a8a8a,
  rara: 0x4a90d9,
  epica: 0xd4af37,
  legendaria: { desde: 0x6a0dad, hasta: 0x000000 },
};

const COLORES_POSICION = {
  POR: 0xf4d03f,
  DEF: 0x3498db,
  MED: 0x2ecc71,
  DEL: 0xe74c3c,
};

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
    const color = COLORES_RAREZA[this.cardData.rarity] ?? COLORES_RAREZA.comun;

    if (this.cardData.rarity === 'legendaria') {
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
  // dibuja centrada dentro de la carta. Si no, dibuja un círculo de color
  // según la posición, igual que hacía CardSprite.js con datos mock.
  dibujarFoto() {
    const clave = claveImagenCarta(this.cardData.id);

    if (this.cardData.photo_url && this.scene.textures.exists(clave)) {
      const foto = new Phaser.GameObjects.Image(this.scene, 0, -6, clave);
      foto.setDisplaySize(88, 88);
      this.add(foto);
      return;
    }

    const colorPosicion = COLORES_POSICION[this.cardData.position] ?? 0xffffff;
    const icono = new Phaser.GameObjects.Graphics(this.scene);
    icono.fillStyle(colorPosicion, 1);
    icono.fillCircle(0, -10, 26);
    icono.lineStyle(2, 0xffffff, 0.8);
    icono.strokeCircle(0, -10, 26);
    this.add(icono);
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
