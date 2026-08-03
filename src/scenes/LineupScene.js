// LineupScene.js — pantalla de armado del 11 titular.
// Muestra las cartas del manager en una grilla (mismo estilo visual que
// CollectionScene/PackOpeningScene), deja tocar hasta 11 para seleccionarlas,
// sugiere una formación y deja guardar el resultado en la tabla `lineups`.
import Phaser from 'phaser';
import { RevealCardSprite, CARD_WIDTH, CARD_HEIGHT, claveImagenCarta, claveBadge } from '../objects/RevealCardSprite.js';
import { FORMATIONS } from '../engine/formations.js';
import { resolveCardImageUrl } from '../utils/cardImage.js';
import {
  countByPosition,
  formacionSugeridaPorDefensores,
  formationFit,
  positionCountsForFormation,
  saveLineup,
} from '../data/lineupsRepo.js';
import { calcularRatingDelOnce, ensureSeason } from '../data/seasonsRepo.js';
import { COLORS, FONTS } from '../theme/tokens.js';
import { getTier } from '../core/ratingTiers.js';
import * as logger from '../core/logger.js';

const COLUMNAS = 4;
const ESPACIO = 14;
const MARGEN_SUPERIOR = 10;
const ALTO_FOOTER = 140; // franja fija de abajo: formación + aviso + botón confirmar
const ALTO_TABS = 32; // franja de tabs POR/DEF/MED/DEL, debajo del contador
const INICIO_GRILLA_Y = 56 + ALTO_TABS; // dónde empieza la grilla, debajo de tabs
// Alto fijo de la zona visible de la grilla: exactamente 2 filas completas
// de cartas. Si una posición tiene más filas, el scroll queda confinado
// dentro de este alto (máscara de Phaser), nunca scrollea la página entera.
const ALTO_GRILLA_VISIBLE = MARGEN_SUPERIOR + 2 * CARD_HEIGHT + ESPACIO;

// Ámbar apagado para la barra de "formación incompleta": un tono cercano a
// COLORS.tier.gold pero desaturado, para no confundirse con el color real
// de una card Gold.
const AMBAR_AVISO = 0x8a7048;
const AMBAR_AVISO_TEXTO = '#c9ad82';

// tokens.js guarda bg/accent/text como strings CSS ('#RRGGBB') porque esos
// también alimentan pantallas HTML (login/crear DT). Los Graphics/Rectangle
// de Phaser necesitan el mismo valor como número (0xRRGGBB), así que hace
// falta este paso de conversión en cada lugar donde se dibuja con ellos.
function hexToNumber(hexString) {
  return parseInt(hexString.replace('#', ''), 16);
}

// Orden fijo de posiciones para las tabs y para el contador de arriba.
const POSICIONES = ['POR', 'DEF', 'MED', 'DEL'];

// Nombres en español de cada posición, para armar el texto del aviso
// ("te faltan 2 defensores"). El segundo valor es el plural.
const NOMBRE_POSICION = {
  POR: ['arquero', 'arqueros'],
  DEF: ['defensor', 'defensores'],
  MED: ['mediocampista', 'mediocampistas'],
  DEL: ['delantero', 'delanteros'],
};

function nombrePosicion(posicion, cantidad) {
  const [singular, plural] = NOMBRE_POSICION[posicion];
  return cantidad === 1 ? singular : plural;
}

// construirStarters arma la lista { slot, card_id } que se guarda en la
// base a partir de las cartas elegidas y la formación activa. Si sobran o
// faltan jugadores de una posición respecto de lo que pide la formación
// (guardado no bloqueante: ver LineupScene.confirmar), igual les asigna un
// slot numerado (DEF1, DEF2, ...) en vez de perderlos.
function construirStarters(cartasSeleccionadas, formationKey) {
  const requeridos = positionCountsForFormation(formationKey);
  const porPosicion = { POR: [], DEF: [], MED: [], DEL: [] };
  for (const carta of cartasSeleccionadas) {
    porPosicion[carta.position]?.push(carta);
  }

  const starters = [];
  for (const posicion of ['POR', 'DEF', 'MED', 'DEL']) {
    porPosicion[posicion].forEach((carta, indice) => {
      const esArqueroUnico = posicion === 'POR' && requeridos.POR === 1 && indice === 0;
      const slot = esArqueroUnico ? 'GK' : `${posicion}${indice + 1}`;
      starters.push({ slot, card_id: carta.user_card_id });
    });
  }
  return starters;
}

export class LineupScene extends Phaser.Scene {
  constructor() {
    super('LineupScene');
  }

  // data = { managerId, cards: [ ...las cartas del manager, ver getManagerCards ], seasonNumber? }
  // seasonNumber es opcional: si no viene, saveLineup usa la temporada
  // actual del manager (managers.current_season).
  init(data) {
    this.managerId = data.managerId;
    this.seasonNumber = data.seasonNumber ?? null;
    // Filtro defensivo: solo cartas con foto real. Los jugadores con
    // photo_url null/undefined/vacío no se muestran (evita fallos al
    // cargar texturas y mantiene la grilla/contador consistentes).
    this.cards = (data.cards ?? []).filter(
      (carta) => carta.photo_url && carta.photo_url.trim() !== ''
    );

    this.seleccionIds = new Set();
    this.cartasPorId = new Map(this.cards.map((carta) => [carta.user_card_id, carta]));
    this.contenedoresPorId = new Map();

    // A diferencia de antes, la formación se elige desde el arranque (no
    // recién al llegar a 11 cartas): así el contador y el bloqueo de cartas
    // saben desde el primer toque cuántos jugadores de cada posición hacen
    // falta. Arranca en la primera formación de la lista (4-4-2).
    this.formacionElegida = Object.keys(FORMATIONS)[0];
    this.listaFormacionesAbierta = null;

    // Tab de posición activa en la grilla (ver crearTabs/cambiarTab): antes
    // se mostraban las 25 cartas juntas y había que scrollear mucho para
    // llegar a los delanteros; ahora la grilla solo muestra una posición a
    // la vez.
    this.posicionActiva = 'POR';
  }

  // Las fotos de estas cartas casi seguro ya se cargaron en PackOpeningScene
  // (son las mismas 25 cartas, con la misma clave de textura por id de
  // catálogo), así que evitamos re-pedirlas si ya están en caché.
  preload() {
    // Dedup en memoria dentro de esta misma corrida de preload: el mismo
    // club/país/liga se repite en muchas de las 25 cartas, y queremos
    // encolar como mucho una carga por URL (this.textures.exists() solo ve
    // texturas de una escena anterior ya cargada, no lo que se está por
    // encolar en este preload).
    const badgesEnCola = new Set();

    for (const carta of this.cards) {
      const clave = claveImagenCarta(carta.id);
      const urlImagen = resolveCardImageUrl(carta);
      logger.log('[DEBUG]', carta.name, { fut_id: carta.fut_id, photo_url: carta.photo_url, urlImagen });
      if (urlImagen && !this.textures.exists(clave)) {
        this.load.image(clave, urlImagen);
      }

      for (const urlBadge of [carta.nation_flag_url, carta.league_logo_url, carta.club_badge_url]) {
        if (!urlBadge) continue; // Fase 1 no corrió para esta carta, o no tiene fut_id: sin drama, RevealCardSprite se lo salta
        const claveIcono = claveBadge(urlBadge);
        if (!this.textures.exists(claveIcono) && !badgesEnCola.has(claveIcono)) {
          badgesEnCola.add(claveIcono);
          this.load.image(claveIcono, urlBadge);
        }
      }
    }

    // Si un ícono puntual falla (404, red caída), solo avisa por consola:
    // el loader sigue con el resto y RevealCardSprite ya chequea
    // this.scene.textures.exists() antes de dibujar cada ícono.
    this.load.on('loaderror', (file) => {
      logger.warn('[DEBUG loaderror]', file.key, file.src);
    });
  }

  create() {
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    // Fondo general de la escena. El panel detrás de la grilla y el del
    // footer usan COLORS.bg.elevated (ver crearGrilla/crearFooter): dos
    // superficies distintas, no un solo color plano.
    this.add.rectangle(anchoPantalla / 2, altoPantalla / 2, anchoPantalla, altoPantalla, hexToNumber(COLORS.bg.base));

    this.add
      .text(anchoPantalla / 2, 14, 'Elegí tu 11 titular', {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Contador de posiciones en vivo (POR 1/1 · DEF 3/4 · ...). Es un
    // container vacío: los textos de adentro se arman en
    // actualizarContadorPosiciones() porque necesitan un color distinto por
    // segmento (verde/gris/rojo), y Phaser no permite pintar de varios
    // colores un mismo objeto de texto.
    this.contenedorContador = this.add.container(anchoPantalla / 2, 36);

    this.crearTabs(anchoPantalla);
    this.crearGrilla(anchoPantalla, altoPantalla);
    this.crearFooter(anchoPantalla, altoPantalla);
    this.actualizarUI();
  }

  // ---------------------------------------------------------------------
  // Tabs de posición (POR/DEF/MED/DEL), debajo del contador (que queda
  // siempre visible arriba, sin moverse). Tocar una tab cambia qué
  // subconjunto de las 25 cartas se ve en la grilla de abajo, así el
  // usuario nunca tiene que scrollear las 25 juntas para llegar, por
  // ejemplo, a los delanteros.
  // ---------------------------------------------------------------------
  crearTabs(anchoPantalla) {
    this.contenedorTabs = this.add.container(0, 0);
    this.dibujarTabs(anchoPantalla);
  }

  // Segmented control tipo píldora: inactiva es texto gris sobre fondo
  // transparente con hover sutil; activa tiene fondo sólido turquesa,
  // sombra chica offset por detrás (ver nota en crearFooter/dibujarPanelFormacion
  // de por qué no se usa postFX.addShadow) y un badge con el contador de esa
  // posición para la formación elegida (ej. "1/4").
  dibujarTabs(anchoPantalla) {
    this.contenedorTabs.removeAll(true);

    const requeridos = positionCountsForFormation(this.formacionElegida);
    const seleccionados = countByPosition(this.cartasSeleccionadas());

    const anchoTab = anchoPantalla / POSICIONES.length;
    const y = 56 + ALTO_TABS / 2;
    const anchoPildora = anchoTab - 10;
    const altoPildora = ALTO_TABS - 6;
    const radio = altoPildora / 2;

    POSICIONES.forEach((posicion, indice) => {
      const activa = posicion === this.posicionActiva;
      const x = anchoTab * indice + anchoTab / 2;

      if (activa) {
        const sombra = this.add.graphics();
        sombra.fillStyle(0x000000, 0.3);
        sombra.fillRoundedRect(x - anchoPildora / 2, y - altoPildora / 2 + 2, anchoPildora, altoPildora, radio);
        this.contenedorTabs.add(sombra);

        const fondo = this.add.graphics();
        fondo.fillStyle(hexToNumber(COLORS.accent), 1);
        fondo.fillRoundedRect(x - anchoPildora / 2, y - altoPildora / 2, anchoPildora, altoPildora, radio);
        this.contenedorTabs.add(fondo);
      }

      const texto = this.add
        .text(x, y, posicion, {
          fontFamily: FONTS.body,
          fontSize: '13px',
          fontStyle: activa ? 'bold' : 'normal',
          color: activa ? COLORS.bg.base : COLORS.text.secondary,
          letterSpacing: 1,
        })
        .setOrigin(0.5);
      this.contenedorTabs.add(texto);

      if (activa) {
        const contador = `${seleccionados[posicion]}/${requeridos[posicion]}`;
        const badge = this.add
          .text(x + texto.width / 2 + 12, y, contador, {
            fontFamily: FONTS.data,
            fontSize: '9px',
            color: COLORS.text.primary,
            backgroundColor: '#00000055',
            padding: { x: 4, y: 2 },
          })
          .setOrigin(0, 0.5);
        this.contenedorTabs.add(badge);
      }

      const zona = this.add.zone(x, y, anchoTab, ALTO_TABS);
      zona.setInteractive({ useHandCursor: true });
      // Hover sutil: solo afecta a tabs inactivas (la activa ya tiene fondo sólido).
      zona.on('pointerover', () => {
        if (!activa) texto.setColor(COLORS.text.primary);
      });
      zona.on('pointerout', () => {
        if (!activa) texto.setColor(COLORS.text.secondary);
      });
      zona.on('pointerdown', () => this.cambiarTab(posicion));
      this.contenedorTabs.add(zona);
    });
  }

  cambiarTab(posicion) {
    if (posicion === this.posicionActiva) return;
    this.posicionActiva = posicion;
    // reconstruirGrillaVisible arma las cartas de la tab nueva;
    // actualizarUI ya redibuja las tabs (badge de contador) como parte de
    // su refresco normal, así que no hace falta duplicarlo acá.
    this.reconstruirGrillaVisible();
    this.actualizarUI();
  }

  // ---------------------------------------------------------------------
  // Grilla de cartas (scrollable, igual que CollectionScene) con una
  // máscara para que no se dibujen encima del footer de abajo. Solo
  // muestra las cartas de this.posicionActiva (ver reconstruirGrillaVisible).
  // ---------------------------------------------------------------------
  crearGrilla(anchoPantalla, altoPantalla) {
    // Alto fijo del grid: 2 filas completas de cartas (ver constante
    // ALTO_GRILLA_VISIBLE). El header, las tabs, el panel de formación y el
    // botón Confirmar quedan siempre visibles; si una posición tiene más de
    // 2 filas, el scroll es SOLO dentro de esta zona.
    const altoVisible = ALTO_GRILLA_VISIBLE;

    // Panel de fondo detrás de la grilla: superficie "elevated", distinta
    // del fondo general "base" de la escena (ver create()).
    this.add.rectangle(
      anchoPantalla / 2,
      INICIO_GRILLA_Y + altoVisible / 2,
      anchoPantalla,
      altoVisible,
      hexToNumber(COLORS.bg.elevated)
    );

    this.gridContainer = this.add.container(0, INICIO_GRILLA_Y);

    // Máscara: recorta el contenido de gridContainer a la franja fija
    // [INICIO_GRILLA_Y, INICIO_GRILLA_Y + ALTO_GRILLA_VISIBLE] de la
    // pantalla, para que al hacer scroll las cartas no se sigan viendo por
    // encima del footer fijo de abajo (ni por encima de las tabs), y nunca
    // quede una fila cortada a la mitad.
    const formaMascara = this.make.graphics({ add: false });
    formaMascara.fillRect(0, INICIO_GRILLA_Y, anchoPantalla, altoVisible);
    this.gridContainer.setMask(formaMascara.createGeometryMask());

    this.reconstruirGrillaVisible();

    this.input.on('wheel', (_pointer, _gameObjects, _deltaX, deltaY) => {
      const nuevaY = this.gridContainer.y - deltaY;
      this.gridContainer.y = Phaser.Math.Clamp(nuevaY, this.scrollMinY, this.scrollMaxY);
    });
  }

  // Vacía y vuelve a armar el contenido de gridContainer con solo las
  // cartas de this.posicionActiva. Se llama al entrar a la escena y cada
  // vez que se toca una tab distinta (cambiarTab). contenedoresPorId
  // también se reinicia: solo necesita tener las cartas que están
  // efectivamente dibujadas ahora mismo (actualizarUI() solo pinta lo que
  // está visible).
  reconstruirGrillaVisible() {
    this.gridContainer.removeAll(true);
    this.contenedoresPorId.clear();

    const anchoPantalla = this.scale.width;
    const anchoGrilla = COLUMNAS * CARD_WIDTH + (COLUMNAS - 1) * ESPACIO;
    const offsetX = (anchoPantalla - anchoGrilla) / 2;

    const cartasDeLaTab = this.cards.filter((carta) => carta.position === this.posicionActiva);

    cartasDeLaTab.forEach((carta, indice) => {
      const columna = indice % COLUMNAS;
      const fila = Math.floor(indice / COLUMNAS);
      const x = offsetX + columna * (CARD_WIDTH + ESPACIO) + CARD_WIDTH / 2;
      const y = MARGEN_SUPERIOR + fila * (CARD_HEIGHT + ESPACIO) + CARD_HEIGHT / 2;

      const contenedor = this.crearCartaSeleccionable(carta, x, y);
      this.gridContainer.add(contenedor);
      this.contenedoresPorId.set(carta.user_card_id, contenedor);

      // Entrada con escala + fade en vez de aparecer instantáneamente, con
      // un stagger chico por índice para que la grilla entre en cascada.
      contenedor.setScale(0.85);
      contenedor.setAlpha(0);
      this.tweens.add({
        targets: contenedor,
        scale: 1,
        alpha: 1,
        duration: 220,
        delay: Math.min(indice, COLUMNAS * 2) * 20,
        ease: 'Cubic.easeOut',
      });
    });

    const altoVisible = ALTO_GRILLA_VISIBLE;
    const filasTotales = Math.max(1, Math.ceil(cartasDeLaTab.length / COLUMNAS));
    const altoContenido = MARGEN_SUPERIOR + filasTotales * CARD_HEIGHT + (filasTotales - 1) * ESPACIO + MARGEN_SUPERIOR;

    // El scroll queda confinado al alto fijo del grid: si el contenido
    // entra en 2 filas no hay scroll; si hay más, scrollea solo acá adentro
    // (la máscara de crearGrilla recorta el resto).
    this.scrollMinY = Math.min(INICIO_GRILLA_Y, INICIO_GRILLA_Y + altoVisible - altoContenido);
    this.scrollMaxY = INICIO_GRILLA_Y;
    this.gridContainer.y = INICIO_GRILLA_Y; // vuelve arriba del todo al cambiar de tab
  }

  // Arma una carta "clickeable": la carta visual (RevealCardSprite) más un
  // marco verde (se muestra si está seleccionada) y un velo oscuro (se
  // muestra si ya hay 11 elegidas y esta carta no es una de ellas, para
  // dejar claro que no se puede sumar una más).
  crearCartaSeleccionable(cardData, x, y) {
    const contenedor = this.add.container(x, y);

    const sprite = new RevealCardSprite(this, 0, 0, cardData);
    contenedor.add(sprite);

    const marco = this.add.graphics();
    marco.lineStyle(5, 0x2ecc71, 1);
    marco.strokeRoundedRect(-CARD_WIDTH / 2 - 4, -CARD_HEIGHT / 2 - 4, CARD_WIDTH + 8, CARD_HEIGHT + 8, 10);
    marco.setVisible(false);
    contenedor.add(marco);

    const velo = this.add.rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, 0x000000, 0.55);
    velo.setVisible(false);
    contenedor.add(velo);

    // veloPosicion: velo ámbar para "esta posición ya está completa en la
    // formación actual". Distinto del velo negro de arriba (que es "ya
    // elegiste 11 en total"), para que el usuario entienda la diferencia
    // de un vistazo.
    const veloPosicion = this.add.rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, 0xf4a300, 0.45);
    veloPosicion.setVisible(false);
    contenedor.add(veloPosicion);

    const zona = this.add.zone(0, 0, CARD_WIDTH, CARD_HEIGHT);
    zona.setInteractive({ useHandCursor: true });
    zona.on('pointerdown', () => this.alternarSeleccion(cardData.user_card_id));
    contenedor.add(zona);

    contenedor.marco = marco;
    contenedor.velo = velo;
    contenedor.veloPosicion = veloPosicion;
    return contenedor;
  }

  alternarSeleccion(id) {
    const carta = this.cartasPorId.get(id);
    const yaEstaba = this.seleccionIds.has(id);

    if (!yaEstaba) {
      if (this.seleccionIds.size >= 11) return; // ya hay 11, no deja sumar más
      if (this.posicionCompleta(carta.position)) return; // esa posición ya está completa, no deja sumar otra
    }

    if (yaEstaba) {
      this.seleccionIds.delete(id);
    } else {
      this.seleccionIds.add(id);
      this.dispararShineSiEsSpecial(id, carta);
    }

    this.autoSeleccionarFormacion();
    this.actualizarUI();
  }

  // Shine sweep: cuando una card cuya banda es SPECIAL pasa a estar
  // seleccionada (no al deseleccionarla, ni al reconstruir la grilla en un
  // cambio de tab), un brillo diagonal la cruza una sola vez. Gold/Silver/
  // Bronze no llevan este efecto.
  dispararShineSiEsSpecial(id, carta) {
    if (getTier(carta.overall_rating) !== 'SPECIAL') return;
    const contenedor = this.contenedoresPorId.get(id);
    if (!contenedor) return; // la carta seleccionada no está en la tab visible ahora mismo

    const bounds = contenedor.getBounds();
    const formaMascara = this.make.graphics({ add: false });
    formaMascara.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    const mascara = formaMascara.createGeometryMask();

    const franja = this.add.rectangle(-CARD_WIDTH, 0, 46, CARD_HEIGHT * 1.6, 0xffffff, 0.35);
    franja.setAngle(22);
    franja.setBlendMode(Phaser.BlendModes.ADD);
    franja.setMask(mascara);
    contenedor.add(franja);

    this.tweens.add({
      targets: franja,
      x: CARD_WIDTH,
      duration: 450,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        mascara.destroy();
        franja.destroy();
      },
    });
  }

  cartasSeleccionadas() {
    return [...this.seleccionIds].map((id) => this.cartasPorId.get(id));
  }

  // Cada vez que cambia la selección, mira cuántos defensores hay elegidos
  // y si esa cantidad identifica una única formación estándar (ver
  // formacionSugeridaPorDefensores en lineups.js), la propone sola —
  // actualiza this.formacionElegida sin que el usuario tenga que abrir el
  // dropdown "Cambiar formación". Si la cantidad de defensores es ambigua
  // (por ejemplo 4, que sirve tanto para 4-4-2 como para 4-3-3) o no
  // corresponde a ninguna formación, no toca nada: se respeta lo que ya
  // estaba elegido, manual o no.
  autoSeleccionarFormacion() {
    const cantidadDef = countByPosition(this.cartasSeleccionadas()).DEF;
    const sugerida = formacionSugeridaPorDefensores(cantidadDef);
    if (sugerida) this.formacionElegida = sugerida;
  }

  // posicionCompleta indica si ya elegiste tantos jugadores de esa posición
  // como pide la formación actual (ej: ya tenés 4 defensores en una 4-4-2).
  // Se usa para bloquear el toque de cartas nuevas de esa posición.
  posicionCompleta(posicion) {
    const requeridos = positionCountsForFormation(this.formacionElegida);
    const seleccionados = countByPosition(this.cartasSeleccionadas());
    return seleccionados[posicion] >= requeridos[posicion];
  }

  // ---------------------------------------------------------------------
  // Footer fijo: panel de formación (siempre visible, ya no espera a que
  // haya 11 cartas elegidas) y botón de confirmar.
  // ---------------------------------------------------------------------
  crearFooter(anchoPantalla, altoPantalla) {
    const yFooter = altoPantalla - ALTO_FOOTER;
    this.yFooter = yFooter;

    // Superficie "elevated" del footer (misma que detrás de la grilla, ver
    // crearGrilla) y un hairline separador arriba, en vez del divisor dorado
    // de antes: el turquesa queda como único acento de acción de la pantalla.
    this.add.rectangle(anchoPantalla / 2, yFooter + ALTO_FOOTER / 2, anchoPantalla, ALTO_FOOTER, hexToNumber(COLORS.bg.elevated));
    this.add.rectangle(anchoPantalla / 2, yFooter, anchoPantalla, 1, hexToNumber(COLORS.text.secondary), 0.3);

    // Formación + botón "Cambiar" + aviso de lo que falta: se redibuja
    // entero cada vez que cambia algo (dibujarPanelFormacion), porque el
    // texto de la formación y el aviso cambian de contenido.
    this.panelFormacion = this.add.container(0, 0);

    // El botón "CONFIRMAR 11" se crea UNA sola vez acá (a diferencia del
    // panel de arriba) porque solo necesitamos prender/apagar su estado
    // habilitado, no recrearlo. Los colores de cada estado los pone
    // actualizarBotonConfirmar().
    this.botonConfirmar = this.add
      .text(anchoPantalla / 2, yFooter + ALTO_FOOTER - 26, 'CONFIRMAR 11', {
        fontFamily: FONTS.body,
        fontSize: '16px',
        fontStyle: 'bold',
        letterSpacing: 1.5,
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5);
    this.botonConfirmar.on('pointerdown', () => this.confirmar());

    this.dibujarPanelFormacion();
  }

  actualizarUI() {
    const requeridos = positionCountsForFormation(this.formacionElegida);
    const seleccionados = countByPosition(this.cartasSeleccionadas());
    const totalCompleto = this.seleccionIds.size >= 11;

    this.actualizarContadorPosiciones(requeridos, seleccionados);
    // Redibuja las tabs: el badge de contador de la tab activa (ver
    // dibujarTabs) tiene que reflejar la selección actual, no solo
    // actualizarse al cambiar de tab.
    this.dibujarTabs(this.scale.width);

    for (const [id, contenedor] of this.contenedoresPorId) {
      const carta = this.cartasPorId.get(id);
      const seleccionada = this.seleccionIds.has(id);
      const posicionCompleta = seleccionados[carta.position] >= requeridos[carta.position];

      contenedor.marco.setVisible(seleccionada);
      // Velo negro: ya hay 11 en total, esta carta se queda afuera sí o sí.
      contenedor.velo.setVisible(!seleccionada && totalCompleto);
      // Velo ámbar: todavía no hay 11, pero la posición de esta carta ya
      // está completa para la formación elegida (no se puede sumar otra).
      contenedor.veloPosicion.setVisible(!seleccionada && !totalCompleto && posicionCompleta);
    }

    this.dibujarPanelFormacion();
    this.actualizarBotonConfirmar();
  }

  // Dibuja la fila "POR 1/1  ·  DEF 3/4  ·  MED 2/3  ·  DEL 1/3" arriba de
  // la grilla. Cada posición es un Text aparte (con su propio color) porque
  // Phaser no permite pintar de varios colores un mismo objeto de texto;
  // por eso también hay que recalcular a mano el ancho total para centrar
  // la fila entera.
  actualizarContadorPosiciones(requeridos, seleccionados) {
    this.contenedorContador.removeAll(true);

    const orden = ['POR', 'DEF', 'MED', 'DEL'];
    const piezas = [];
    orden.forEach((posicion, indice) => {
      const tengo = seleccionados[posicion];
      const necesito = requeridos[posicion];
      let color = '#9aa5b8'; // gris: todavía falta
      if (tengo === necesito) color = '#2ecc71'; // verde: posición completa
      else if (tengo > necesito) color = '#e74c3c'; // rojo: sobran (pasa si cambiaste de formación con cartas ya elegidas)
      piezas.push({ texto: `${posicion} ${tengo}/${necesito}`, color });
      if (indice < orden.length - 1) piezas.push({ texto: '   ·   ', color: '#5a6478' });
    });

    const textos = piezas.map((pieza) =>
      this.add.text(0, 0, pieza.texto, { fontFamily: FONTS.data, fontSize: '15px', color: pieza.color })
    );
    const anchoTotal = textos.reduce((suma, texto) => suma + texto.width, 0);

    let x = -anchoTotal / 2;
    for (const texto of textos) {
      texto.setPosition(x, 0);
      x += texto.width;
      this.contenedorContador.add(texto);
    }
  }

  // Habilita/deshabilita visualmente "Confirmar 11": solo se puede tocar
  // cuando la selección calza exacto con la formación elegida (11
  // jugadores, con el mínimo de cada posición, ni de más ni de menos).
  actualizarBotonConfirmar() {
    const fit = formationFit(this.cartasSeleccionadas(), this.formacionElegida);

    if (fit.exact) {
      this.botonConfirmar.setInteractive({ useHandCursor: true });
      this.botonConfirmar.setStyle({ backgroundColor: COLORS.accent, color: COLORS.bg.base });
      this.botonConfirmar.setAlpha(1);
    } else {
      this.botonConfirmar.disableInteractive();
      this.botonConfirmar.setStyle({ backgroundColor: '#3a4256', color: '#7a8296' });
      this.botonConfirmar.setAlpha(0.8);
    }
  }

  dibujarPanelFormacion() {
    this.panelFormacion.removeAll(true); // limpia lo que había dibujado antes de redibujar

    const anchoPantalla = this.scale.width;
    const y = this.yFooter;
    const fit = formationFit(this.cartasSeleccionadas(), this.formacionElegida);
    const label = FORMATIONS[this.formacionElegida].label;

    const textoFormacion = this.add.text(30, y + 22, `Formación: ${label}`, {
      fontFamily: FONTS.body,
      fontSize: '16px',
      color: COLORS.text.primary,
    });
    this.panelFormacion.add(textoFormacion);

    // "Cambiar ▼": ya no es un botón sólido dorado, es una caja con borde
    // hairline y fondo transparente (mismo tratamiento que la barra de
    // aviso de abajo).
    const textoCambiar = this.add.text(0, 0, 'Cambiar ▼', {
      fontFamily: FONTS.body,
      fontSize: '14px',
      color: COLORS.text.primary,
    });
    const padXCambiar = 10;
    const padYCambiar = 6;
    const anchoCambiar = textoCambiar.width + padXCambiar * 2;
    const altoCambiar = textoCambiar.height + padYCambiar * 2;
    const xCambiar = anchoPantalla - 30 - anchoCambiar;
    const yCambiar = y + 22;
    textoCambiar.setPosition(xCambiar + padXCambiar, yCambiar + padYCambiar);

    const cajaCambiar = this.add.rectangle(
      xCambiar + anchoCambiar / 2,
      yCambiar + altoCambiar / 2,
      anchoCambiar,
      altoCambiar
    );
    cajaCambiar.setStrokeStyle(1, hexToNumber(COLORS.text.secondary), 0.3);
    this.panelFormacion.add(cajaCambiar);
    this.panelFormacion.add(textoCambiar);

    const zonaCambiar = this.add.zone(
      xCambiar + anchoCambiar / 2,
      yCambiar + altoCambiar / 2,
      anchoCambiar,
      altoCambiar
    );
    zonaCambiar.setInteractive({ useHandCursor: true });
    zonaCambiar.on('pointerdown', () => this.alternarListaFormaciones(anchoPantalla, y));
    this.panelFormacion.add(zonaCambiar);

    if (!fit.exact) {
      const partes = [];
      for (const [posicion, cantidad] of Object.entries(fit.faltan)) {
        partes.push(`te faltan ${cantidad} ${nombrePosicion(posicion, cantidad)}`);
      }
      for (const [posicion, cantidad] of Object.entries(fit.sobran)) {
        partes.push(`te sobran ${cantidad} ${nombrePosicion(posicion, cantidad)}`);
      }

      // Barra con borde hairline ámbar (apagado, para no confundirse con
      // una card Gold) + triángulo de advertencia dibujado a mano a la
      // izquierda del texto.
      const xIzq = 30;
      const anchoBarra = anchoPantalla - 60;
      const topBarra = y + 50;
      const altoBarra = 32;
      const centroBarra = topBarra + altoBarra / 2;

      const barra = this.add.rectangle(anchoPantalla / 2, centroBarra, anchoBarra, altoBarra);
      barra.setStrokeStyle(1, AMBAR_AVISO, 0.8);
      this.panelFormacion.add(barra);

      const xTriangulo = xIzq + 16;
      const s = 6;
      const triangulo = this.add.graphics();
      triangulo.fillStyle(AMBAR_AVISO, 1);
      triangulo.fillTriangle(xTriangulo, centroBarra - s, xTriangulo - s, centroBarra + s, xTriangulo + s, centroBarra + s);
      this.panelFormacion.add(triangulo);

      const xTexto = xTriangulo + s + 12;
      const aviso = this.add
        .text(xTexto, centroBarra, `Con ${label} ${partes.join(' y ')}.`, {
          fontFamily: FONTS.body,
          fontSize: '13px',
          color: AMBAR_AVISO_TEXTO,
          wordWrap: { width: anchoPantalla - 30 - xTexto - 10 },
        })
        .setOrigin(0, 0.5);
      this.panelFormacion.add(aviso);
    }
  }

  // Dropdown casero: como Phaser no trae un <select>, la lista de
  // formaciones es simplemente 4 textos apilados que aparecen al tocar
  // "Cambiar" y se cierran solos al elegir una.
  alternarListaFormaciones(anchoPantalla, yFooter) {
    if (this.listaFormacionesAbierta) {
      this.cerrarListaFormaciones();
      return;
    }

    const lista = this.add.container(anchoPantalla - 150, yFooter - 4 * 30);
    Object.keys(FORMATIONS).forEach((clave, indice) => {
      const opcion = this.add
        .text(0, indice * 30, FORMATIONS[clave].label, {
          fontFamily: 'Arial',
          fontSize: '13px',
          color: '#ffffff',
          backgroundColor: '#1e2a4a',
          padding: { x: 10, y: 6 },
        })
        .setInteractive({ useHandCursor: true });
      opcion.on('pointerdown', () => {
        this.formacionElegida = clave;
        this.cerrarListaFormaciones();
        // Al cambiar de formación cambian los requeridos por posición, así
        // que hay que refrescar todo: contador, velos de las cartas y el
        // botón de confirmar (no solo el panel de formación).
        this.actualizarUI();
      });
      lista.add(opcion);
    });

    this.listaFormacionesAbierta = lista;
  }

  cerrarListaFormaciones() {
    this.listaFormacionesAbierta?.destroy();
    this.listaFormacionesAbierta = null;
  }

  async confirmar() {
    // Esto solo puede pasar si el botón está habilitado (ver
    // actualizarBotonConfirmar), pero lo chequeamos igual por las dudas de
    // que llegue algún click mientras se está redibujando la pantalla.
    if (!formationFit(this.cartasSeleccionadas(), this.formacionElegida).exact) return;

    this.botonConfirmar.disableInteractive();
    this.botonConfirmar.setText('GUARDANDO...');

    const seleccionadas = this.cartasSeleccionadas();
    const starters = construirStarters(seleccionadas, this.formacionElegida);
    const bench = this.cards
      .filter((carta) => !this.seleccionIds.has(carta.user_card_id))
      .map((carta) => carta.user_card_id);

    const slots = { formation: this.formacionElegida, starters, bench };

    try {
      const lineupGuardado = await saveLineup(this.managerId, this.seasonNumber, this.formacionElegida, slots);

      // Guardamos el lineup confirmado y la temporada REAL que resolvió
      // saveLineup (podría diferir de this.seasonNumber si el manager no
      // tenía temporada en curso y se le creó una): los necesitamos en
      // mostrarExito para arrancar SeasonScene con el número correcto
      // DESPUÉS de que la persistencia terminó con éxito.
      this.lineupGuardado = lineupGuardado;
      this.seasonNumber = lineupGuardado.season_number;

      try {
        const rating = calcularRatingDelOnce(seleccionadas);
        await ensureSeason(this.managerId, lineupGuardado.season_number, rating);
      } catch (errorSeason) {
        // No bloquea el flujo de éxito: el 11 ya se guardó bien, y el
        // rating snapshot se puede volver a intentar la próxima vez que
        // el usuario confirme un 11.
        logger.error('No se pudo guardar el rating de temporada:', errorSeason);
      }

      this.mostrarExito();
    } catch (error) {
      logger.error('No se pudo guardar el lineup:', error);
      this.botonConfirmar.setText('CONFIRMAR 11');
      this.actualizarBotonConfirmar(); // vuelve a habilitarlo (la selección sigue siendo válida)
      this.mostrarError(error);
    }
  }

  mostrarError(error) {
    const anchoPantalla = this.scale.width;
    this.textoError?.destroy();
    this.textoError = this.add
      .text(anchoPantalla / 2, this.yFooter + ALTO_FOOTER - 4, `No se pudo guardar: ${error.message}`, {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#e74c3c',
      })
      .setOrigin(0.5, 1);
  }

  mostrarExito() {
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    // Tapamos toda la pantalla con el mensaje final; no hace falta
    // desarmar prolijamente la grilla de atrás, esta escena termina acá.
    this.add.rectangle(anchoPantalla / 2, altoPantalla / 2, anchoPantalla, altoPantalla, 0x1a1a2e, 0.97);

    this.add
      .text(anchoPantalla / 2, altoPantalla / 2 - 30, '¡Once titular guardado!', {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Botón principal: "Jugar Temporada". Como mostrarExito() se ejecuta
    // SIEMPRE después de que confirmar() terminó el await de saveLineup/
    // ensureSeason, la persistencia del 11 ya está completa cuando se
    // navega a SeasonScene (que además hoy valida el lineup y deriva al
    // jugador a armar el 11 si no existiera).
    const botonJugar = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 + 20, 'Jugar Temporada ▶', {
        fontFamily: 'Arial',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#1a1a2e',
        backgroundColor: '#2ecc71',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    botonJugar.on('pointerdown', () =>
      this.scene.start('SeasonScene', {
        managerId: this.managerId,
        seasonNumber: this.lineupGuardado?.season_number ?? this.seasonNumber,
      })
    );

    // Acción secundaria: si el jugador prefiere volver a la colección antes
    // de arrancar la temporada, también puede (el 11 ya quedó guardado).
    const botonColeccion = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 + 70, 'Volver a mi Dream Team', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#3a4256',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    botonColeccion.on('pointerdown', () =>
      this.scene.start('CollectionScene', { managerId: this.managerId, cards: this.cards })
    );
  }
}
