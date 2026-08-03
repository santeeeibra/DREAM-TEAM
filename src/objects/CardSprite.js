// CardSprite.js — dibuja una "carta de jugador" completa (estilo pack de cromos)
// usando solo formas y texto de Phaser (Graphics + Text), sin ninguna imagen externa.
//
// La idea de un Container: es como una "carpeta" que agrupa varios objetos
// (formas, textos, íconos) y los mueve/escala todos juntos como si fueran uno solo.
// Por eso CardSprite extiende Phaser.GameObjects.Container: así podemos hacer
// `const carta = new CardSprite(...)` y tratarla como un objeto único en la escena.

import Phaser from 'phaser';
import { getTier } from '../shared/ratingTiers.js';
import { colorDeCarta } from '../shared/cardColors.js';
import { claveAvatarIniciales } from '../utils/initialsAvatar.js';
import { FONTS } from '../theme/tokens.js';

// Tamaño fijo de la carta (ancho x alto). Las constantes en mayúsculas indican
// "esto no cambia", lo dejamos acá arriba para poder ajustarlo fácil en un solo lugar.
// Las exportamos porque CollectionScene.js las necesita para calcular la grilla
// (separación entre cartas, alto total de la lista, etc).
export const CARD_WIDTH = 120;
export const CARD_HEIGHT = 170;

// Clave de textura de la foto real de la carta (misma convención que
// claveImagenCarta en RevealCardSprite.js: se preloadea en CollectionScene
// y puede que ya esté en caché de una escena anterior, PackOpening/Lineup).
export function claveFotoCarta(cardId) {
  return `card-img-${cardId}`;
}

// dibujarSiluetaGenerica: el placeholder que se usa cuando a una carta
// todavía no le cargó ni la foto real ni (en CollectionScene) el avatar
// genérico de Dicebear. Antes esto era un círculo sólido de un color por
// posición (azul, verde...), que se leía como un error visual más que como
// un placeholder; ahora es un ícono neutro de persona (cabeza + hombros).
// Las proporciones quedan siempre DENTRO del círculo de fondo a propósito,
// sin usar una máscara: una máscara fija no se reacomoda sola cuando esta
// carta vive dentro de un container que después hace scroll (como en
// LineupScene), así que en vez de recortar dibujamos figuras que ya nacen
// más chicas que el radio exterior.
export function dibujarSiluetaGenerica(scene, x = 0, y = -10, radio = 26) {
  const icono = new Phaser.GameObjects.Graphics(scene);

  icono.fillStyle(0x4a5468, 1);
  icono.fillCircle(x, y, radio);
  icono.lineStyle(2, 0xffffff, 0.8);
  icono.strokeCircle(x, y, radio);

  icono.fillStyle(0xaeb8cc, 1);
  icono.fillCircle(x, y - radio * 0.32, radio * 0.36); // cabeza
  icono.fillCircle(x, y + radio * 0.45, radio * 0.42); // hombros

  return icono;
}

export class CardSprite extends Phaser.GameObjects.Container {
  // scene: la escena donde va a vivir la carta
  // x, y: posición donde se ubica el CENTRO de la carta
  // cardData: el objeto jugador (mismo formato que mockCards.js / tabla `cards`)
  constructor(scene, x, y, cardData) {
    super(scene, x, y); // le avisamos al Container dónde debe posicionarse

    this.cardData = cardData; // guardamos los datos por si los necesitamos después (ej. al hacer click)

    this.dibujarFondoEscudo();
    this.dibujarRatingYPosicion();
    this.dibujarIconoAvatar();
    this.dibujarNombre();
    this.dibujarPie();
    this.dibujarLogoPropio();

    // Un Container recién creado no aparece solo en pantalla: hay que agregarlo
    // a la lista de objetos que la escena efectivamente dibuja.
    scene.add.existing(this);
  }

  // Dibuja el fondo con forma de "escudo": un rectángulo con las esquinas cortadas
  // (más cortadas abajo, para que se afine como un escudo) en vez de un rectángulo simple.
  dibujarFondoEscudo() {
    const hw = CARD_WIDTH / 2; // mitad del ancho (half width)
    const hh = CARD_HEIGHT / 2; // mitad del alto (half height)
    const corteArriba = 14; // cuánto se corta en las esquinas de arriba
    const corteAbajo = 34; // cuánto se corta en las esquinas de abajo (más grande = más "punta" de escudo)

    // Lista de puntos (x, y) que forman el contorno del escudo, dando la vuelta
    // en sentido horario empezando arriba a la izquierda. Todas las coordenadas
    // son relativas al centro de la carta (0, 0), porque estamos dentro del Container.
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

    // Graphics es el "lienzo" donde dibujamos formas libres (no imágenes).
    // Lo creamos sin pasar por scene.add para no duplicarlo: lo agregamos
    // directo al Container al final con this.add(...).
    const fondo = new Phaser.GameObjects.Graphics(this.scene);

    // La banda (bronze/silver/gold/special) sale del overall_rating, no de
    // cardData.rarity: esa columna es un concepto de la base totalmente
    // distinto (comun/rara/epica/legendaria, probabilidad de drop).
    // colorDeCarta ya calcula la banda internamente con getTier(); acá solo
    // la volvemos a pedir para saber si hay que usar degradado (SPECIAL) o
    // color sólido.
    const banda = getTier(this.cardData.overall_rating);
    const colorBanda = colorDeCarta(this.cardData);

    if (banda === 'SPECIAL') {
      // fillGradientStyle pinta un degradado entre 4 esquinas (arriba-izq, arriba-der,
      // abajo-izq, abajo-der). Usamos violeta arriba y negro abajo para el degradado pedido.
      fondo.fillGradientStyle(
        colorBanda.desde,
        colorBanda.desde,
        colorBanda.hasta,
        colorBanda.hasta,
        1
      );
    } else {
      fondo.fillStyle(colorBanda, 1);
    }
    fondo.fillPoints(puntos, true); // true = cierra la figura (conecta el último punto con el primero)

    // Un borde fino blanco para que la carta se despegue del fondo del juego
    fondo.lineStyle(3, 0xffffff, 0.9);
    fondo.strokePoints(puntos, true);

    this.add(fondo); // lo sumamos al Container
  }

  // Número grande del overall_rating arriba a la izquierda, y el texto de la
  // posición (POR/DEF/MED/DEL) chico justo debajo.
  dibujarRatingYPosicion() {
    const hw = CARD_WIDTH / 2;
    const hh = CARD_HEIGHT / 2;

    const textoRating = new Phaser.GameObjects.Text(
      this.scene,
      -hw + 12,
      -hh + 10,
      String(this.cardData.overall_rating),
      {
        fontFamily: FONTS.display,
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffffff',
      }
    );
    this.add(textoRating);

    const textoPosicion = new Phaser.GameObjects.Text(
      this.scene,
      -hw + 12,
      -hh + 38,
      this.cardData.position,
      {
        fontFamily: FONTS.data,
        fontSize: '14px',
        color: '#ffffff',
      }
    );
    this.add(textoPosicion);
  }

  // Retrato del jugador: probamos, en orden, la foto real
  // (cards.photo_url, precargada por CollectionScene.preload con la clave
  // de claveFotoCarta) y, si no llegó a cargar, el avatar de iniciales
  // (src/utils/initialsAvatar.js, precargado con claveAvatarIniciales).
  // Con iniciales siempre hay algo que mostrar, así que no hace falta un
  // tercer fallback.
  dibujarIconoAvatar() {
    const claveFoto = claveFotoCarta(this.cardData.id);
    const clave = this.scene.textures.exists(claveFoto)
      ? claveFoto
      : claveAvatarIniciales(this.cardData.id);

    const imagen = new Phaser.GameObjects.Image(this.scene, 0, -10, clave);
    imagen.setDisplaySize(60, 60);
    this.add(imagen);
  }

  // Nombre del jugador, debajo del ícono/avatar.
  dibujarNombre() {
    const texto = new Phaser.GameObjects.Text(this.scene, 0, 26, this.cardData.name, {
      fontFamily: FONTS.body,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
      align: 'center',
    });
    texto.setOrigin(0.5, 0); // origen centrado horizontalmente, para que el texto quede alineado al medio
    this.add(texto);
  }

  // Club y nacionalidad, en texto chico al pie de la carta.
  dibujarPie() {
    const hh = CARD_HEIGHT / 2;

    const textoClub = new Phaser.GameObjects.Text(this.scene, 0, hh - 36, this.cardData.club, {
      fontFamily: FONTS.body,
      fontSize: '11px',
      color: '#ffffff',
      align: 'center',
    });
    textoClub.setOrigin(0.5, 0);
    this.add(textoClub);

    const textoNacionalidad = new Phaser.GameObjects.Text(
      this.scene,
      0,
      hh - 22,
      this.cardData.nationality,
      {
        fontFamily: FONTS.body,
        fontSize: '11px',
        color: '#dddddd',
        align: 'center',
      }
    );
    textoNacionalidad.setOrigin(0.5, 0);
    this.add(textoNacionalidad);
  }

  // "Logo" propio del juego: un círculo chico con las iniciales "DT" (Dream Team)
  // en una esquina de la carta. Reemplaza cualquier logo de marca real (ej. EA/FIFA)
  // por un ícono genérico nuestro.
  dibujarLogoPropio() {
    const hw = CARD_WIDTH / 2;
    const hh = CARD_HEIGHT / 2;
    const cx = hw - 20; // posición del centro del círculo, esquina superior derecha
    const cy = -hh + 20;

    const circulo = new Phaser.GameObjects.Graphics(this.scene);
    circulo.fillStyle(0x000000, 0.55);
    circulo.fillCircle(cx, cy, 14);
    circulo.lineStyle(1.5, 0xffffff, 0.9);
    circulo.strokeCircle(cx, cy, 14);
    this.add(circulo);

    // TODO revisar fuente
    const texto = new Phaser.GameObjects.Text(this.scene, cx, cy, 'DT', {
      fontFamily: FONTS.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    texto.setOrigin(0.5, 0.5); // centrado exacto dentro del círculo
    this.add(texto);
  }
}
