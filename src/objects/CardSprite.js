// CardSprite.js — dibuja una "carta de jugador" completa (estilo pack de cromos)
// usando solo formas y texto de Phaser (Graphics + Text), sin ninguna imagen externa.
//
// La idea de un Container: es como una "carpeta" que agrupa varios objetos
// (formas, textos, íconos) y los mueve/escala todos juntos como si fueran uno solo.
// Por eso CardSprite extiende Phaser.GameObjects.Container: así podemos hacer
// `const carta = new CardSprite(...)` y tratarla como un objeto único en la escena.

import Phaser from 'phaser';
import { getTier } from '../shared/ratingTiers.js';
import { claveAvatarGenerico } from '../utils/avatarGenerator.js';

// Tamaño fijo de la carta (ancho x alto). Las constantes en mayúsculas indican
// "esto no cambia", lo dejamos acá arriba para poder ajustarlo fácil en un solo lugar.
// Las exportamos porque CollectionScene.js las necesita para calcular la grilla
// (separación entre cartas, alto total de la lista, etc).
export const CARD_WIDTH = 140;
export const CARD_HEIGHT = 200;

// Clave de textura de la foto real de la carta (misma convención que
// claveImagenCarta en RevealCardSprite.js: se preloadea en CollectionScene
// y puede que ya esté en caché de una escena anterior, PackOpening/Lineup).
export function claveFotoCarta(cardId) {
  return `card-img-${cardId}`;
}

// Colores de fondo según la BANDA de rating (bronze/silver/gold/special que
// devuelve getTier() a partir de overall_rating). Ojo: esto es independiente
// de la columna `cards.rarity` (comun/rara/epica/legendaria), que es un
// concepto distinto (probabilidad de drop en los sobres) — ver el comentario
// en migrations/004_open_pack.sql.
// Los números tipo 0xRRGGBB son la forma en que Phaser espera los colores
// (es el mismo valor hexadecimal que usarías en CSS como "#A56A45", pero con 0x en vez de #).
const COLORES_BANDA = {
  BRONZE: 0xa56a45,
  SILVER: 0x9fb4c7,
  GOLD: 0xd4af37,
  // "special" no es un color único: es un degradado violeta -> negro.
  // Guardamos los dos extremos del degradado para usarlos con fillGradientStyle.
  SPECIAL: { desde: 0x6a0dad, hasta: 0x000000 },
};

// Color del ícono placeholder de avatar, según la posición del jugador en la
// cancha. Coincide con el enum real de la base (position_type en
// migrations/001_init.sql: POR/DEF/MED/DEL). Es el último fallback si ni la
// foto real ni el avatar genérico llegaron a cargarse.
const COLORES_POSICION = {
  POR: 0xf4d03f, // amarillo, como la camiseta típica de arquero
  DEF: 0x3498db, // azul
  MED: 0x2ecc71, // verde
  DEL: 0xe74c3c, // rojo
};

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
    const banda = getTier(this.cardData.overall_rating);
    const colorBanda = COLORES_BANDA[banda];

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
        fontFamily: 'Arial',
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
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#ffffff',
      }
    );
    this.add(textoPosicion);
  }

  // Retrato del jugador: probamos, en orden, la foto real
  // (cards.photo_url, precargada por CollectionScene.preload con la clave
  // de claveFotoCarta), después el avatar genérico de Dicebear
  // (src/utils/avatarGenerator.js, precargado con claveAvatarGenerico), y
  // solo si ninguna de las dos texturas llegó a cargar, el círculo de color
  // por posición (último fallback, no debería verse en el juego real).
  dibujarIconoAvatar() {
    const claveFoto = claveFotoCarta(this.cardData.id);
    if (this.cardData.photo_url && this.scene.textures.exists(claveFoto)) {
      const foto = new Phaser.GameObjects.Image(this.scene, 0, -10, claveFoto);
      foto.setDisplaySize(60, 60);
      this.add(foto);
      return;
    }

    const claveAvatar = claveAvatarGenerico(this.cardData.id);
    if (this.scene.textures.exists(claveAvatar)) {
      const avatar = new Phaser.GameObjects.Image(this.scene, 0, -10, claveAvatar);
      avatar.setDisplaySize(60, 60);
      this.add(avatar);
      return;
    }

    const colorPosicion = COLORES_POSICION[this.cardData.position] ?? 0xffffff;
    const icono = new Phaser.GameObjects.Graphics(this.scene);
    icono.fillStyle(colorPosicion, 1);
    icono.fillCircle(0, -10, 26); // círculo centrado en (0, -10), con radio 26
    icono.lineStyle(2, 0xffffff, 0.8);
    icono.strokeCircle(0, -10, 26);

    this.add(icono);
  }

  // Nombre del jugador, debajo del ícono/avatar.
  dibujarNombre() {
    const texto = new Phaser.GameObjects.Text(this.scene, 0, 26, this.cardData.name, {
      fontFamily: 'Arial',
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
      fontFamily: 'Arial',
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
        fontFamily: 'Arial',
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

    const texto = new Phaser.GameObjects.Text(this.scene, cx, cy, 'DT', {
      fontFamily: 'Arial',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    texto.setOrigin(0.5, 0.5); // centrado exacto dentro del círculo
    this.add(texto);
  }
}
