// RevealCardSprite.js — la carta que se muestra durante la animación de
// apertura de sobres y en LineupScene. Es parecida a CardSprite.js (mismo
// tamaño, mismo estilo "escudo", misma paleta de bandas de rating y mismo
// placeholder de silueta), pero en vez de la foto/avatar de Dicebear usa
// solo la foto real del jugador (`cards.photo_url`) cuando está disponible.
import Phaser from 'phaser';
import { CARD_WIDTH, CARD_HEIGHT } from './CardSprite.js';
import { getTier } from '../core/ratingTiers.js';
import { colorDeCarta } from '../shared/cardColors.js';
import { fitImagen } from '../utils/fitImage.js';
import { claveAvatarIniciales } from '../utils/initialsAvatar.js';
import { FONTS } from '../theme/tokens.js';

export { CARD_WIDTH, CARD_HEIGHT };

// Rejilla de alineación de la columna izquierda (estilo EA). Todas las
// posiciones verticales derivan de esta única cadena de constantes, así que
// ajustar un espaciado mueve toda la columna junta. Valores tuneados para
// despegar la columna del borde y mantener el escudo lejos del corte
// diagonal inferior de la carta.
const COL_IZQ_X = -34; // despegada del borde izquierdo
const ESPACIO_TEXTO = 18; // acerca la posición al rating
const ESPACIO_ICONOS = 24; // comprime bandera → liga → escudo
const POS_RATING_Y = -52; // respira, no pegado al margen superior
const POS_POSICION_Y = POS_RATING_Y + ESPACIO_TEXTO;
const POS_BANDERA_Y = POS_POSICION_Y + ESPACIO_ICONOS;
const POS_LIGA_Y = POS_BANDERA_Y + ESPACIO_ICONOS;
const POS_CLUB_Y = POS_LIGA_Y + ESPACIO_ICONOS; // 38: a salvo del corte diagonal

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
    // this.dibujarGradienteInferior(); // DESACTIVADO: el fondo de la carta ya
    // tiene contraste oscuro suficiente en la base (todas las bandas terminan
    // su degradado/color en un tono oscuro), así que el texto blanco de nombre
    // y club se lee bien sin este parche negro. Si en el futuro se introduce un
    // diseño de carta más claro que necesite ese contraste artificial para que
    // el texto siga siendo legible, reactivar esta línea (y el método abajo).
    this.dibujarRatingYPosicion();
    this.dibujarInsignias();
    this.dibujarNombre();

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

    // Desplazada a la derecha (estilo EA): la columna izquierda de
    // rating/posición/insignias ocupa todo el lateral, así que el retrato
    // vive contra el borde derecho de la carta.
    const imagen = new Phaser.GameObjects.Image(this.scene, 16, -8, clave);
    // contain: la foto entra completa dentro del marco 88×88 sin estirarse
    // (una textura no cuadrada ya no se deforma para llenar el cuadrado).
    fitImagen(imagen, 88, 88, 'contain');
    this.add(imagen);
  }

  // DESACTIVADO (ver la llamada comentada en el constructor): la franja oscura
  // (transparente arriba → negro abajo) en el tercio inferior de la carta,
  // detrás de nombre y club, ya no se dibuja porque el fondo de la carta —en
  // todas sus bandas— termina en un tono oscuro que alcanza para que el texto
  // blanco se lea bien. Además, fillRect dibujaba un bloque recto que rompía
  // la forma diagonal del escudo en los bordes inferiores.
  //
  // Si en el futuro el diseño de carta se aclara y el texto vuelve a perderse
  // contra fotos claras, descomentar la llamada en el constructor y este método:
  //
  // dibujarGradienteInferior() {
  //   const hw = CARD_WIDTH / 2;
  //   const hh = CARD_HEIGHT / 2;
  //   const alto = CARD_HEIGHT / 3;
  //   const y = hh - alto;
  //
  //   const gradiente = new Phaser.GameObjects.Graphics(this.scene);
  //   gradiente.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.85, 0.85);
  //   gradiente.fillRect(-hw, y, CARD_WIDTH, alto);
  //   this.add(gradiente);
  // }

  // Número grande del overall_rating y texto de posición (POR/DEF/MED/DEL),
  // alineados en la columna izquierda de la carta. Cada uno en su fila fija
  // de la rejilla (POS_RATING_Y / POS_POSICION_Y), centrados en su posición.
  dibujarRatingYPosicion() {
    const textoRating = new Phaser.GameObjects.Text(
      this.scene,
      COL_IZQ_X,
      POS_RATING_Y,
      String(this.cardData.overall_rating),
      { fontFamily: FONTS.display, fontSize: '24px', fontStyle: 'bold', color: '#ffffff' }
    );
    textoRating.setOrigin(0.5);
    this.add(textoRating);

    const textoPosicion = new Phaser.GameObjects.Text(
      this.scene,
      COL_IZQ_X,
      POS_POSICION_Y,
      this.cardData.position,
      { fontFamily: FONTS.data, fontSize: '14px', color: '#ffffff' }
    );
    textoPosicion.setOrigin(0.5);
    this.add(textoPosicion);
  }

  // Columna vertical chica debajo del rating/posición (esquina superior
  // izquierda, estilo carta EA FC): bandera de país → logo de liga → escudo
  // de club, en ese orden. Cada uno tiene su fila fija (POS_BANDERA_Y,
  // POS_LIGA_Y, POS_CLUB_Y) de la rejilla; si a la carta le falta ese dato
  // (Fase 1 no corrió, o la carta no tiene fut_id) o la textura todavía no
  // cargó, esa fila se salta sin romper el resto del layout.
  dibujarInsignias() {
    const filas = [
      { url: this.cardData.nation_flag_url, y: POS_BANDERA_Y },
      { url: this.cardData.league_logo_url, y: POS_LIGA_Y },
      { url: this.cardData.club_badge_url, y: POS_CLUB_Y },
    ];

    const tamaño = 16;
    for (const { url, y } of filas) {
      const clave = url ? claveBadge(url) : null;
      if (clave && this.scene.textures.exists(clave)) {
        const icono = new Phaser.GameObjects.Image(this.scene, COL_IZQ_X, y, clave);
        // contain: banderas (aprox. 22:15) y logos conservan su proporción
        // en el marco cuadrado de 16×16 en vez de deformarse.
        fitImagen(icono, tamaño, tamaño, 'contain');
        this.add(icono);
      }
    }
  }

  // El nombre cuelga del borde inferior (origin y = 1) y crece hacia arriba
  // si hace wordWrap a dos líneas. El club ya no se dibuja en texto: lo
  // reemplaza el escudo en la columna izquierda (POS_CLUB_Y).
  dibujarNombre() {
    const hh = CARD_HEIGHT / 2;

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
