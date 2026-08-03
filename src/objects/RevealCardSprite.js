// RevealCardSprite.js — la carta que se muestra durante la animación de
// apertura de sobres y en LineupScene. Es parecida a CardSprite.js (mismo
// tamaño, mismo estilo "escudo", misma paleta de bandas de rating y mismo
// placeholder de silueta), pero en vez de la foto/avatar de Dicebear usa
// solo la foto real del jugador (`cards.photo_url`) cuando está disponible.
import Phaser from 'phaser';
import { CARD_WIDTH, CARD_HEIGHT } from './CardSprite.js';
import { getTier } from '../core/ratingTiers.js';
import { colorDeCarta } from '../shared/cardColors.js';
import { claveAvatarIniciales } from '../utils/initialsAvatar.js';
import { FONTS } from '../theme/tokens.js';

export { CARD_WIDTH, CARD_HEIGHT };

// Clave de textura que le corresponde a una carta si su foto llegó a
// cargarse bien (ver PackOpeningScene.preload()).
export function claveImagenCarta(cardId) {
  return `card-img-${cardId}`;
}

// Clave de textura para un ícono de escudo/bandera/liga. Se indexa por la
// URL misma (no por eaId, que no llega hasta acá): como el mismo club/país/
// liga se repite en muchas cartas, distintas cartas con la misma URL piden
// la misma clave y Phaser solo la carga una vez (ver LineupScene.preload()).
export function claveBadge(url) {
  return `badge-${url}`;
}

export class RevealCardSprite extends Phaser.GameObjects.Container {
  constructor(scene, x, y, cardData) {
    super(scene, x, y);
    this.cardData = cardData;

    this.dibujarFondoEscudo();
    this.dibujarFoto();
    this.dibujarGradienteInferior();
    this.dibujarRatingYPosicion();
    this.dibujarInsignias();
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
    const claveFoto = claveImagenCarta(this.cardData.id);
    const clave = this.scene.textures.exists(claveFoto)
      ? claveFoto
      : claveAvatarIniciales(this.cardData.id);

    const imagen = new Phaser.GameObjects.Image(this.scene, 0, -6, clave);
    imagen.setDisplaySize(88, 88);
    this.add(imagen);
  }

  // Franja oscura (transparente arriba → negro abajo) en el tercio inferior
  // de la carta, detrás de nombre y club (ver dibujarNombreYClub): sin esto
  // el texto blanco se pierde contra fotos claras.
  dibujarGradienteInferior() {
    const hw = CARD_WIDTH / 2;
    const hh = CARD_HEIGHT / 2;
    const alto = CARD_HEIGHT / 3;
    const y = hh - alto;

    const gradiente = new Phaser.GameObjects.Graphics(this.scene);
    gradiente.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.85, 0.85);
    gradiente.fillRect(-hw, y, CARD_WIDTH, alto);
    this.add(gradiente);
  }

  dibujarRatingYPosicion() {
    const hw = CARD_WIDTH / 2;
    const hh = CARD_HEIGHT / 2;

    const textoRating = new Phaser.GameObjects.Text(
      this.scene,
      -hw + 12,
      -hh + 10,
      String(this.cardData.overall_rating),
      { fontFamily: FONTS.display, fontSize: '26px', fontStyle: 'bold', color: '#ffffff' }
    );
    this.add(textoRating);

    const textoPosicion = new Phaser.GameObjects.Text(
      this.scene,
      -hw + 12,
      -hh + 38,
      this.cardData.position,
      { fontFamily: FONTS.data, fontSize: '14px', color: '#ffffff' }
    );
    this.add(textoPosicion);
  }

  // Columna vertical chica debajo del rating/posición (esquina superior
  // izquierda, estilo carta EA FC): bandera de país → logo de liga → escudo
  // de club, en ese orden. Cada uno es una fila fija; si a la carta le falta
  // ese dato (Fase 1 no corrió, o la carta no tiene fut_id) o la textura
  // todavía no cargó, esa fila se salta sin romper el resto del layout.
  dibujarInsignias() {
    const hw = CARD_WIDTH / 2;
    const hh = CARD_HEIGHT / 2;
    const tamaño = 16;
    const espacio = 4;
    const x = -hw + 20;
    let y = -hh + 58;

    const urls = [this.cardData.nation_flag_url, this.cardData.league_logo_url, this.cardData.club_badge_url];
    for (const url of urls) {
      const clave = url ? claveBadge(url) : null;
      if (clave && this.scene.textures.exists(clave)) {
        const icono = new Phaser.GameObjects.Image(this.scene, x, y, clave);
        icono.setDisplaySize(tamaño, tamaño);
        this.add(icono);
      }
      y += tamaño + espacio;
    }
  }

  dibujarNombreYClub() {
    const hh = CARD_HEIGHT / 2;

    // Anclados por el borde inferior (origin y = 1): el club queda pegado
    // abajo y el nombre crece hacia arriba si hace wordWrap a dos líneas,
    // así nunca se amontonan entre sí aunque el nombre sea largo.
    const club = new Phaser.GameObjects.Text(this.scene, 0, hh - 14, this.cardData.club ?? '', {
      fontFamily: FONTS.body,
      fontSize: '11px',
      color: '#dddddd',
      align: 'center',
    });
    club.setOrigin(0.5, 1);
    this.add(club);

    const nombre = new Phaser.GameObjects.Text(this.scene, 0, hh - 30, this.cardData.name, {
      fontFamily: FONTS.body,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: CARD_WIDTH - 16 },
    });
    nombre.setOrigin(0.5, 1);
    this.add(nombre);
  }
}
