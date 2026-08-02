// MatchScene.js — escena de Phaser que muestra un partido jugándose en vivo.
//
// Esta escena NO simula el partido: eso lo hace simulateMatch() en
// src/engine/matchEngine.js, que es lógica pura (sin gráficos). Lo que hace
// esta escena es "escuchar" lo que va pasando en el motor a través de
// callbacks (onMatchReady, onEvent, onDecision) y traducir cada cosa a algo
// visual: mover el reloj, escribir una línea en el feed de relato, mostrar
// el panel de decisión y esperar el click del jugador, etc.
//
// Además del panel de decisión (que ya existía), esta escena tiene dos
// botones siempre visibles arriba ("Formación" y "Cambios") que abren un
// panel propio, pausando el partido igual que hace el panel de decisión,
// para que el jugador pueda cambiar la formación o hacer una sustitución en
// cualquier momento (no solo en los puntos de decisión fijos).
//
// La clave de todo esto es que simulateMatch() es "async" y espera (await)
// lo que le devuelven nuestros callbacks. Como acá adentro también usamos
// async/await y Promises, logramos que el motor se "pause" solo mientras
// termina cada animación, mientras el jugador no eligió una opción todavía,
// o mientras tiene abierto el panel de Formación/Cambios.

import Phaser from 'phaser';
import { simulateMatch, FORMATIONS } from '../engine/matchEngine.js';
import { mockCards } from '../data/mockCards.js'; // TEMPORAL: solo se usa para armar equipos de prueba, ver armarEquipoDePrueba()

// -----------------------------------------------------------------------
// Medidas y tiempos fijos de la puesta en escena
// -----------------------------------------------------------------------

const ALTO_BARRA_SUPERIOR = 100; // franja de arriba: nombres de equipo + marcador + reloj + botones
const ALTO_PANEL_DECISION = 300; // franja de abajo que aparece cuando hay que elegir táctica (hasta 4 opciones)
const MAX_LINEAS_VISIBLES_FEED = 5; // cuántas líneas del relato se ven "bien" (opacas)
const ALTO_LINEA_FEED = 34; // separación vertical entre una línea de relato y la siguiente

// Cuánto dura la pausa (el "silencio" antes de que llegue el próximo evento)
// según el tipo de evento que se acaba de mostrar. Un gol a favor se disfruta
// más tiempo que un gol en contra, por ejemplo.
function duracionDePausa(evento) {
  if (evento.type === 'goal') return evento.team === 'home' ? 2200 : 1400;
  if (evento.type === 'post') return 3000;
  if (evento.type === 'save') return 1000;
  if (evento.type === 'miss') return 400;
  return 800; // kickoff / halftime / fulltime: una pausa corta por defecto
}

// Solo estos tipos de evento generan la "desaceleración" del reloj antes de
// que ocurran, para darle un poco de suspenso al jugador.
const TIPOS_QUE_DESACELERAN = ['goal', 'post', 'save'];

// -----------------------------------------------------------------------
// TEMPORAL: armado de equipos de prueba a partir de mockCards.
// Esto existe solo para poder abrir MatchScene directamente y ver el
// partido andando, sin tener todavía una pantalla previa que arme los
// equipos "de verdad" a partir de la colección del jugador.
// -----------------------------------------------------------------------

// mockCards usa las posiciones 'ARQ'/'DEF'/'MC'/'DEL', pero matchEngine.js
// espera 'POR'/'DEF'/'MED'/'DEL'. Esta tabla traduce de un formato al otro.
const MAPA_DE_POSICIONES = { ARQ: 'POR', DEF: 'DEF', MC: 'MED', DEL: 'DEL' }; // TEMPORAL

// Cuántos suplentes le armamos a cada equipo de prueba (además de los 11 titulares).
const CANTIDAD_DE_SUPLENTES = 5; // TEMPORAL

// mockCards solo trae overall_rating (no trae pace/shooting/passing/defense/
// physical/goalkeeping por separado, que es lo que necesita el motor). Como
// esto es nada más que un equipo de prueba, generamos esas 6 stats a partir
// del overall_rating, con un poco de variación al azar para que no sean
// todas iguales.
function statConVariacion(base) { // TEMPORAL
  const variacion = Math.floor(Math.random() * 17) - 8; // entre -8 y +8
  return Phaser.Math.Clamp(base + variacion, 30, 99);
}

// convertirCartaAJugador transforma una carta de mockCards en el formato de
// jugador que entiende matchEngine.js. Le agregamos un "id" propio (no el de
// la carta, para que sea único dentro del equipo aunque una misma carta se
// repita entre titulares y banco) y un "rating" para mostrar en el panel de
// cambios.
function convertirCartaAJugador(carta, id) { // TEMPORAL
  const posicion = MAPA_DE_POSICIONES[carta.position] || 'MED';
  return {
    id,
    name: carta.name,
    position: posicion,
    rating: carta.overall_rating,
    pace: statConVariacion(carta.overall_rating),
    shooting: statConVariacion(carta.overall_rating),
    passing: statConVariacion(carta.overall_rating),
    defense: statConVariacion(carta.overall_rating),
    physical: statConVariacion(carta.overall_rating),
    goalkeeping: posicion === 'POR' ? statConVariacion(carta.overall_rating) : 0,
  };
}

// armarEquipoDePrueba arma un equipo recorriendo mockCards en círculo (si
// hay menos cartas que jugadores necesarios, empieza de nuevo desde el
// principio y repite cartas hasta completar el plantel): primero los 11
// titulares, y después CANTIDAD_DE_SUPLENTES jugadores más para el banco.
// prefijoId se usa para armar ids únicos por jugador dentro del equipo
// (por ejemplo 'home-0', 'home-banco-0').
function armarEquipoDePrueba(nombre, indiceInicial, prefijoId) { // TEMPORAL
  const jugadores = [];
  for (let i = 0; i < 11; i++) {
    const carta = mockCards[(indiceInicial + i) % mockCards.length];
    jugadores.push(convertirCartaAJugador(carta, `${prefijoId}-${i}`));
  }

  const suplentes = [];
  for (let i = 0; i < CANTIDAD_DE_SUPLENTES; i++) {
    const carta = mockCards[(indiceInicial + 11 + i) % mockCards.length];
    suplentes.push(convertirCartaAJugador(carta, `${prefijoId}-banco-${i}`));
  }

  return { name: nombre, players: jugadores, bench: suplentes };
}

// TEMPORAL: nombres para el próximo rival, hasta que exista el fixture real
// de la temporada. Se usan solo en el botón "Siguiente partido" de la
// pantalla final.
const NOMBRES_DE_RIVALES = ['Atlético Sur', 'Estrella Azul', 'Unión Norte', 'Deportivo Central', 'Los Andes FC']; // TEMPORAL

// armarRivalNuevo arma un rival de prueba nuevo (nombre al azar + un punto
// de partida al azar dentro de mockCards, para que no sea siempre el mismo
// plantel).
function armarRivalNuevo() { // TEMPORAL
  const nombre = NOMBRES_DE_RIVALES[Math.floor(Math.random() * NOMBRES_DE_RIVALES.length)];
  const indiceInicial = Math.floor(Math.random() * mockCards.length);
  // TODO: reemplazar por el fixture real de la temporada (Fase 5)
  return armarEquipoDePrueba(nombre, indiceInicial, 'away');
}

// -----------------------------------------------------------------------
// La escena
// -----------------------------------------------------------------------

export class MatchScene extends Phaser.Scene {
  constructor() {
    super('MatchScene'); // 'MatchScene' es el identificador con el que Phaser reconoce esta escena
  }

  // init() se ejecuta antes que create(), y recibe los datos que le hayan
  // pasado al arrancar la escena (this.scene.start('MatchScene', { ... })).
  // Si en el futuro una pantalla de "armar equipo" nos manda homeSquad y
  // awaySquad ya armados, los vamos a usar. Si no vienen, quedan en null y
  // create() arma el equipo de prueba.
  init(data) {
    this.homeSquad = (data && data.homeSquad) || null;
    this.awaySquad = (data && data.awaySquad) || null;
  }

  create() {
    // Usamos el mismo ancho/alto de canvas que ya está definido en main.js
    // (this.scale.width / this.scale.height siempre reflejan el tamaño real
    // del juego, así que no hace falta repetir los números acá).
    this.anchoPantalla = this.scale.width;
    this.altoPantalla = this.scale.height;

    // TEMPORAL: si no nos pasaron equipos por parámetro, armamos dos
    // equipos de prueba a partir de mockCards para poder ver la escena
    // funcionando ya mismo.
    if (!this.homeSquad || !this.awaySquad) {
      this.homeSquad = armarEquipoDePrueba('Dream FC', 0, 'home');
      this.awaySquad = armarEquipoDePrueba('Rival United', 6, 'away');
    }

    // Estado interno de la escena mientras el partido se está jugando.
    this.marcador = { home: 0, away: 0 };
    this.minutoActual = 0;
    this.lineasFeed = []; // lista de líneas de texto que están en pantalla ahora mismo
    this.matchState = null; // lo llenamos apenas el motor nos avisa (onMatchReady)
    this.decisionPanelAbierto = false;

    this.crearBarraSuperior();
    this.crearZonaDeFeed();
    this.crearPanelDeDecision();
    this.crearPanelAuxiliar();
    this.crearBotonesSuperiores();

    // TEMPORAL: arranca el partido solo apenas se entra a la escena, sin
    // esperar ningún botón de "jugar" (todavía no existe esa pantalla previa).
    this.iniciarPartido();
  }

  // -----------------------------------------------------------------------
  // Barra superior: nombres de equipo, marcador y reloj
  // -----------------------------------------------------------------------

  crearBarraSuperior() {
    // Fondo de la franja superior, para separarla visualmente del feed.
    this.add
      .rectangle(0, 0, this.anchoPantalla, ALTO_BARRA_SUPERIOR, 0x12122a)
      .setOrigin(0, 0);

    // Nombre del equipo local, pegado a la izquierda.
    this.add
      .text(20, 20, this.homeSquad.name || 'Local', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5);

    // Nombre del equipo visitante, pegado a la derecha.
    this.add
      .text(this.anchoPantalla - 20, 20, this.awaySquad.name || 'Visitante', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(1, 0.5);

    // Marcador grande, centrado.
    this.textoMarcador = this.add
      .text(this.anchoPantalla / 2, 24, '0 - 0', {
        fontFamily: 'Arial',
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5);

    // Reloj, debajo del marcador.
    this.textoReloj = this.add
      .text(this.anchoPantalla / 2, 66, "0'", {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#a0a0c0',
      })
      .setOrigin(0.5, 0.5);
  }

  actualizarTextoMarcador() {
    this.textoMarcador.setText(`${this.marcador.home} - ${this.marcador.away}`);
  }

  actualizarTextoReloj() {
    this.textoReloj.setText(`${this.minutoActual}'`);
  }

  // -----------------------------------------------------------------------
  // Botones de arriba: "Formación" y "Cambios (N)" (siempre visibles)
  // -----------------------------------------------------------------------

  // crearBotonSuperior arma un botón chico para la barra de arriba, y
  // devuelve las referencias a su fondo y su etiqueta de texto, para poder
  // actualizarlos después (cambiar el texto, deshabilitarlo, etc). origenX
  // indica si "x" es el borde izquierdo (0) o el borde derecho (1) del botón.
  crearBotonSuperior(x, y, ancho, alto, textoInicial, origenX, alHacerClick) {
    const COLOR_BASE = 0x2b2b55;
    const COLOR_HOVER = 0x40409c;
    const COLOR_DESHABILITADO = 0x16162c;

    const centroX = origenX === 0 ? x + ancho / 2 : x - ancho / 2;
    const contenedor = this.add.container(centroX, y);

    const fondo = this.add.rectangle(0, 0, ancho, alto, COLOR_BASE, 0.9).setStrokeStyle(1, 0xffffff, 0.4);
    const etiqueta = this.add
      .text(0, 0, textoInicial, {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5, 0.5);

    contenedor.add([fondo, etiqueta]);

    fondo.setInteractive({ useHandCursor: true });
    fondo.on('pointerover', () => fondo.setFillStyle(COLOR_HOVER, 0.9));
    fondo.on('pointerout', () => fondo.setFillStyle(COLOR_BASE, 0.9));
    fondo.on('pointerdown', () => alHacerClick());

    return { contenedor, fondo, etiqueta, COLOR_BASE, COLOR_DESHABILITADO };
  }

  crearBotonesSuperiores() {
    const anchoBoton = 140;
    const altoBoton = 26;
    const y = 82; // dentro de la franja superior, debajo de los nombres de equipo

    // Botón "Formación": va pegado a la izquierda, debajo del nombre local.
    this.botonFormacion = this.crearBotonSuperior(16, y, anchoBoton, altoBoton, '⚙ Formación: 4-4-2', 0, () => {
      this.abrirPanelFormacion();
    });

    // Botón "Cambios (N)": va pegado a la derecha, debajo del nombre visitante.
    this.botonCambios = this.crearBotonSuperior(this.anchoPantalla - 16, y, anchoBoton, altoBoton, '⇄ Cambios (3)', 1, () => {
      this.abrirPanelCambios();
    });
  }

  // actualizarBotonFormacionTexto pone en el botón la formación activa del
  // equipo local, leyéndola del matchState del motor.
  actualizarBotonFormacionTexto() {
    const clave = this.matchState.getFormation('home');
    this.botonFormacion.etiqueta.setText(`⚙ Formación: ${clave}`);
  }

  // actualizarBotonCambiosTexto pone en el botón cuántas sustituciones le
  // quedan al equipo local, y lo deshabilita (visual y funcionalmente)
  // cuando ya no le quedan.
  actualizarBotonCambiosTexto() {
    const restantes = this.matchState.getCambiosRestantes('home');
    this.botonCambios.etiqueta.setText(`⇄ Cambios (${restantes})`);

    if (restantes <= 0) {
      this.botonCambios.fondo.disableInteractive();
      this.botonCambios.fondo.setFillStyle(this.botonCambios.COLOR_DESHABILITADO, 0.9);
      this.botonCambios.etiqueta.setAlpha(0.4);
    } else {
      this.botonCambios.fondo.setInteractive({ useHandCursor: true });
      this.botonCambios.fondo.setFillStyle(this.botonCambios.COLOR_BASE, 0.9);
      this.botonCambios.etiqueta.setAlpha(1);
    }
  }

  // -----------------------------------------------------------------------
  // Zona central: feed de narrativa (las líneas de texto que van contando el partido)
  // -----------------------------------------------------------------------

  crearZonaDeFeed() {
    // Y donde va apoyada la línea MÁS NUEVA del feed (las anteriores se van
    // acomodando hacia arriba de esta posición).
    this.feedYInferior = this.altoPantalla - 40;
    this.feedXIzquierda = 30;

    // Un container es más fácil de limpiar/ordenar que ir agregando textos sueltos.
    this.feedContainer = this.add.container(0, 0);
  }

  // agregarLineaDeFeed mete una línea de texto nueva abajo del feed, la hace
  // aparecer con un fade-in, y empuja hacia arriba (con fade) a las líneas
  // que ya estaban.
  agregarLineaDeFeed(texto) {
    const nuevaLinea = this.add.text(this.feedXIzquierda, this.feedYInferior, texto, {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#ffffff',
      wordWrap: { width: this.anchoPantalla - this.feedXIzquierda * 2 },
    });
    nuevaLinea.setOrigin(0, 1);
    nuevaLinea.setAlpha(0);
    this.feedContainer.add(nuevaLinea);

    this.lineasFeed.push(nuevaLinea);

    // Recorremos TODAS las líneas actuales (incluida la nueva) y les
    // calculamos su posición Y y su alpha final según qué tan "vieja" es:
    // 0 = la más nueva (recién agregada), 1 = la anterior, etc.
    const cantidadDeLineas = this.lineasFeed.length;
    this.lineasFeed.forEach((linea, indice) => {
      const antiguedad = cantidadDeLineas - 1 - indice; // 0 = más nueva
      const y = this.feedYInferior - antiguedad * ALTO_LINEA_FEED;

      let alphaObjetivo;
      if (antiguedad < MAX_LINEAS_VISIBLES_FEED) {
        // Las últimas 5 se ven, pero cada una un poco más tenue que la anterior.
        alphaObjetivo = 1 - antiguedad * 0.18;
      } else {
        // Las más viejas que eso se terminan de desvanecer del todo.
        alphaObjetivo = 0;
      }

      this.tweens.add({
        targets: linea,
        y,
        alpha: alphaObjetivo,
        duration: 200,
        ease: 'Sine.easeOut',
      });
    });

    // Las líneas que ya llegaron a alpha 0 no hacen falta más: las sacamos
    // de la lista y las destruimos (con un pequeño delay para que el tween
    // de fade-out anterior llegue a terminar antes de borrarlas).
    const lineasQueSobran = this.lineasFeed.length - (MAX_LINEAS_VISIBLES_FEED + 2);
    if (lineasQueSobran > 0) {
      const lineasAEliminar = this.lineasFeed.splice(0, lineasQueSobran);
      this.time.delayedCall(220, () => {
        lineasAEliminar.forEach((linea) => linea.destroy());
      });
    }
  }

  // -----------------------------------------------------------------------
  // Zona inferior: panel de decisión (arranca oculto)
  // -----------------------------------------------------------------------

  crearPanelDeDecision() {
    // El panel es un container que vive JUSTO debajo del borde inferior de
    // la pantalla cuando está "cerrado", y se desliza hacia arriba cuando
    // hay que mostrarlo.
    this.panelDecision = this.add.container(0, this.altoPantalla);

    const fondo = this.add.rectangle(0, 0, this.anchoPantalla, ALTO_PANEL_DECISION, 0x1c1c3d, 0.97).setOrigin(0, 0);
    fondo.setStrokeStyle(2, 0xffffff, 0.25);
    this.panelDecision.add(fondo);

    // El título (decision.situation) y los botones se crean de nuevo cada
    // vez que se abre el panel, así que los guardamos en un sub-container
    // aparte para poder vaciarlo fácil sin tocar el fondo.
    this.panelContenido = this.add.container(0, 0);
    this.panelDecision.add(this.panelContenido);
  }

  // mostrarDecision muestra el panel con las opciones de "decision" (que
  // ahora vienen armadas por el motor a partir de TACTICS, ver
  // matchEngine.js) y devuelve una Promise que NO resuelve hasta que el
  // jugador clickea un botón. Al resolver, entrega el id de la táctica
  // elegida.
  mostrarDecision(decision) {
    return new Promise((resolve) => {
      this.decisionPanelAbierto = true;

      // Vaciamos lo que haya quedado de una decisión anterior.
      this.panelContenido.removeAll(true);

      const titulo = this.add.text(24, 22, decision.situation, {
        fontFamily: 'Arial',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
        wordWrap: { width: this.anchoPantalla - 48 },
      });
      this.panelContenido.add(titulo);

      // Un botón rectangular por cada táctica ofrecida, apilados verticalmente.
      const anchoBoton = this.anchoPantalla - 48;
      const altoBoton = 42;
      const separacion = 8;
      decision.options.forEach((opcion, indice) => {
        const y = 64 + indice * (altoBoton + separacion);
        const boton = this.crearBoton(24 + anchoBoton / 2, y + altoBoton / 2, anchoBoton, altoBoton, opcion.label, () => {
          this.ocultarPanelDeDecision().then(() => {
            this.decisionPanelAbierto = false;
            resolve(opcion.id);
          });
        });
        this.panelContenido.add(boton);
      });

      this.mostrarPanelDeDecision();
    });
  }

  mostrarPanelDeDecision() {
    this.tweens.add({
      targets: this.panelDecision,
      y: this.altoPantalla - ALTO_PANEL_DECISION,
      duration: 300,
      ease: 'Sine.easeOut',
    });
  }

  ocultarPanelDeDecision() {
    return new Promise((resolve) => {
      this.tweens.add({
        targets: this.panelDecision,
        y: this.altoPantalla,
        duration: 300,
        ease: 'Sine.easeIn',
        onComplete: resolve,
      });
    });
  }

  // -----------------------------------------------------------------------
  // Panel auxiliar: lo comparten "Formación" y "Cambios". Arranca oculto,
  // igual que el panel de decisión, y se desliza hacia arriba/abajo con el
  // mismo tween. El contenido de adentro (título + opciones) se arma de
  // nuevo cada vez que se abre, según cuál de los dos botones lo disparó.
  // -----------------------------------------------------------------------

  crearPanelAuxiliar() {
    // Deja lugar arriba para que la barra superior (con sus botones) nunca
    // quede tapada por este panel.
    this.altoPanelAuxiliar = Math.min(460, this.altoPantalla - ALTO_BARRA_SUPERIOR - 40);

    this.panelAuxiliar = this.add.container(0, this.altoPantalla);

    const fondo = this.add.rectangle(0, 0, this.anchoPantalla, this.altoPanelAuxiliar, 0x1c1c3d, 0.97).setOrigin(0, 0);
    fondo.setStrokeStyle(2, 0xffffff, 0.25);
    this.panelAuxiliar.add(fondo);

    this.panelAuxiliarContenido = this.add.container(0, 0);
    this.panelAuxiliar.add(this.panelAuxiliarContenido);

    this.panelAuxiliarAbierto = false;
    this.promesaPausaAuxiliar = null; // mientras no sea null, manejarEvento() se queda esperando acá
    this.resolverPausaAuxiliar = null;
  }

  // iniciarPausaAuxiliar arma una Promise que manejarEvento() va a esperar
  // (await) antes de mostrar el próximo evento del partido: así, mientras
  // el panel de Formación/Cambios está abierto, el reloj y el feed no
  // avanzan más.
  iniciarPausaAuxiliar() {
    this.panelAuxiliarAbierto = true;
    this.promesaPausaAuxiliar = new Promise((resolve) => {
      this.resolverPausaAuxiliar = resolve;
    });
  }

  // reanudarDesdePausaAuxiliar resuelve esa Promise, y el partido sigue
  // andando desde donde había quedado.
  reanudarDesdePausaAuxiliar() {
    this.panelAuxiliarAbierto = false;
    this.resolverPausaAuxiliar?.();
    this.promesaPausaAuxiliar = null;
    this.resolverPausaAuxiliar = null;
  }

  deslizarPanelAuxiliarArriba() {
    this.tweens.add({
      targets: this.panelAuxiliar,
      y: this.altoPantalla - this.altoPanelAuxiliar,
      duration: 300,
      ease: 'Sine.easeOut',
    });
  }

  // cerrarPanelAuxiliar desliza el panel hacia abajo (mismo tween de salida
  // que usa el panel de decisión) y, al terminar, reanuda el partido.
  cerrarPanelAuxiliar() {
    this.tweens.add({
      targets: this.panelAuxiliar,
      y: this.altoPantalla,
      duration: 300,
      ease: 'Sine.easeIn',
      onComplete: () => this.reanudarDesdePausaAuxiliar(),
    });
  }

  // agregarBotonCerrarPanelAuxiliar pone un link chico de "Cerrar" arriba a
  // la derecha del panel, para poder salir sin elegir nada (por ejemplo, si
  // el jugador abrió "Formación" solo para mirar).
  agregarBotonCerrarPanelAuxiliar() {
    const boton = this.add
      .text(this.anchoPantalla - 20, 16, 'Cerrar ✕', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#a0a0c0',
      })
      .setOrigin(1, 0);
    boton.setInteractive({ useHandCursor: true });
    boton.on('pointerdown', () => this.cerrarPanelAuxiliar());
    this.panelAuxiliarContenido.add(boton);
  }

  // -----------------------------------------------------------------------
  // Panel de Formación
  // -----------------------------------------------------------------------

  abrirPanelFormacion() {
    if (this.panelAuxiliarAbierto || this.decisionPanelAbierto || !this.matchState) return;
    this.iniciarPausaAuxiliar();
    this.mostrarContenidoFormacion();
    this.deslizarPanelAuxiliarArriba();
  }

  mostrarContenidoFormacion() {
    this.panelAuxiliarContenido.removeAll(true);

    const titulo = this.add.text(24, 20, 'Elegí la formación', {
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    this.panelAuxiliarContenido.add(titulo);
    this.agregarBotonCerrarPanelAuxiliar();

    // Un botón por cada formación de FORMATIONS (matchEngine.js), apilados
    // verticalmente igual que en el panel de decisión.
    const anchoBoton = this.anchoPantalla - 48;
    const altoBoton = 46;
    Object.keys(FORMATIONS).forEach((clave, indice) => {
      const y = 70 + indice * (altoBoton + 10);
      const boton = this.crearBoton(24 + anchoBoton / 2, y + altoBoton / 2, anchoBoton, altoBoton, FORMATIONS[clave].label, () => {
        this.matchState.setFormation('home', clave);
        this.actualizarBotonFormacionTexto();
        this.cerrarPanelAuxiliar();
      });
      this.panelAuxiliarContenido.add(boton);
    });
  }

  // -----------------------------------------------------------------------
  // Panel de Cambios (sustituciones)
  // -----------------------------------------------------------------------

  abrirPanelCambios() {
    if (this.panelAuxiliarAbierto || this.decisionPanelAbierto || !this.matchState) return;
    if (this.matchState.getCambiosRestantes('home') <= 0) return;
    this.iniciarPausaAuxiliar();
    this.mostrarContenidoCambios();
    this.deslizarPanelAuxiliarArriba();
  }

  // crearFilaDeJugador arma una fila chica y clickeable (nombre + rating)
  // para usar en las dos columnas del panel de Cambios (banco y titulares).
  crearFilaDeJugador(x, y, ancho, jugador, alHacerClick) {
    const alto = 22;
    const contenedor = this.add.container(x, y);

    const fondo = this.add.rectangle(0, 0, ancho, alto, 0x22224a).setOrigin(0, 0.5).setStrokeStyle(1, 0xffffff, 0.15);
    const texto = this.add
      .text(8, 0, `${jugador.name} (${jugador.rating ?? '-'})`, {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5);

    contenedor.add([fondo, texto]);

    fondo.setInteractive({ useHandCursor: true });
    fondo.on('pointerdown', () => alHacerClick());

    return { container: contenedor, fondo, jugadorId: jugador.id };
  }

  mostrarContenidoCambios() {
    this.panelAuxiliarContenido.removeAll(true);

    const titulo = this.add.text(24, 16, 'Hacer un cambio', {
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    this.panelAuxiliarContenido.add(titulo);
    this.agregarBotonCerrarPanelAuxiliar();

    const mitad = this.anchoPantalla / 2;
    const anchoColumna = mitad - 34;

    const subtituloBanco = this.add.text(24, 50, 'Banco', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#a0a0c0',
    });
    const subtituloTitulares = this.add.text(mitad + 10, 50, 'Titulares', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#a0a0c0',
    });
    this.panelAuxiliarContenido.add([subtituloBanco, subtituloTitulares]);

    // Guardamos acá (variables locales, no en "this") quién está elegido de
    // cada lado: el que sale (un titular) y el que entra (un suplente).
    let jugadorSaleId = null;
    let jugadorEntraId = null;

    const ALTO_FILA = 24;
    const filasBanco = [];
    const filasTitulares = [];

    // resaltarFila pinta de otro color la fila seleccionada dentro de una
    // columna, y deja las demás con su color normal.
    const resaltarFila = (filas, idSeleccionado) => {
      filas.forEach((fila) => {
        fila.fondo.setFillStyle(fila.jugadorId === idSeleccionado ? 0x40409c : 0x22224a);
      });
    };

    // actualizarBotonConfirmar habilita el botón de abajo recién cuando hay
    // un jugador elegido de cada columna.
    const actualizarBotonConfirmar = () => {
      const habilitado = jugadorSaleId !== null && jugadorEntraId !== null;
      botonConfirmarFondo.setFillStyle(habilitado ? 0x2b2b55 : 0x16162c);
      botonConfirmarTexto.setAlpha(habilitado ? 1 : 0.4);
      if (habilitado) {
        botonConfirmarFondo.setInteractive({ useHandCursor: true });
      } else {
        botonConfirmarFondo.disableInteractive();
      }
    };

    this.homeSquad.bench.forEach((jugador, indice) => {
      const fila = this.crearFilaDeJugador(24, 74 + indice * ALTO_FILA, anchoColumna, jugador, () => {
        jugadorEntraId = jugador.id;
        resaltarFila(filasBanco, jugadorEntraId);
        actualizarBotonConfirmar();
      });
      filasBanco.push(fila);
      this.panelAuxiliarContenido.add(fila.container);
    });

    this.homeSquad.players.forEach((jugador, indice) => {
      const fila = this.crearFilaDeJugador(mitad + 10, 74 + indice * ALTO_FILA, anchoColumna, jugador, () => {
        jugadorSaleId = jugador.id;
        resaltarFila(filasTitulares, jugadorSaleId);
        actualizarBotonConfirmar();
      });
      filasTitulares.push(fila);
      this.panelAuxiliarContenido.add(fila.container);
    });

    // Botón "Confirmar cambio", abajo del todo, deshabilitado hasta que
    // haya un jugador elegido de cada lado.
    const botonConfirmarContenedor = this.add.container(mitad, this.altoPanelAuxiliar - 34);
    const botonConfirmarFondo = this.add.rectangle(0, 0, 220, 44, 0x16162c).setStrokeStyle(2, 0xffffff, 0.5);
    const botonConfirmarTexto = this.add
      .text(0, 0, 'Confirmar cambio', { fontFamily: 'Arial', fontSize: '16px', color: '#ffffff' })
      .setOrigin(0.5, 0.5)
      .setAlpha(0.4);
    botonConfirmarContenedor.add([botonConfirmarFondo, botonConfirmarTexto]);
    this.panelAuxiliarContenido.add(botonConfirmarContenedor);

    botonConfirmarFondo.on('pointerdown', () => {
      const resultado = this.matchState.substitutePlayer('home', jugadorSaleId, jugadorEntraId);
      if (resultado.ok) {
        this.actualizarBotonCambiosTexto();
        this.cerrarPanelAuxiliar();
      }
    });
  }

  // -----------------------------------------------------------------------
  // Botón genérico (se usa para las opciones de decisión, formación y la pantalla final)
  // -----------------------------------------------------------------------

  crearBoton(x, y, ancho, alto, texto, alHacerClick) {
    const COLOR_BASE = 0x2b2b55;
    const COLOR_HOVER = 0x40409c;

    const contenedor = this.add.container(x, y);

    const fondo = this.add.rectangle(0, 0, ancho, alto, COLOR_BASE).setStrokeStyle(2, 0xffffff, 0.5);
    const etiqueta = this.add.text(0, 0, texto, {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: ancho - 20 },
    });
    etiqueta.setOrigin(0.5, 0.5);

    contenedor.add([fondo, etiqueta]);

    fondo.setInteractive({ useHandCursor: true });
    fondo.on('pointerover', () => fondo.setFillStyle(COLOR_HOVER));
    fondo.on('pointerout', () => fondo.setFillStyle(COLOR_BASE));
    fondo.on('pointerdown', () => alHacerClick());

    return contenedor;
  }

  // -----------------------------------------------------------------------
  // El reloj: avanza con un tween, y se desacelera antes de eventos importantes
  // -----------------------------------------------------------------------

  // esperar() envuelve this.time.delayedCall en una Promise, para poder
  // escribir "await this.esperar(ms)" y que el código de más abajo espere
  // ese tiempo antes de seguir.
  esperar(ms) {
    return new Promise((resolve) => {
      this.time.delayedCall(ms, resolve);
    });
  }

  // animarRelojHasta mueve this.minutoActual (y el texto del reloj) desde el
  // minuto actual hasta minutoObjetivo. Si conDesaceleracion es true, el
  // último tramo del recorrido se hace más lento (los últimos ~600ms), para
  // generar anticipación antes de un evento importante.
  animarRelojHasta(minutoObjetivo, conDesaceleracion) {
    return new Promise((resolve) => {
      const distancia = minutoObjetivo - this.minutoActual;

      // Si ya estamos en ese minuto (o el objetivo es "para atrás", cosa que
      // no debería pasar), no hace falta animar nada.
      if (distancia <= 0) {
        this.minutoActual = minutoObjetivo;
        this.actualizarTextoReloj();
        resolve();
        return;
      }

      const estado = { minuto: this.minutoActual };

      const avanzarEstado = () => {
        this.minutoActual = Math.floor(estado.minuto);
        this.actualizarTextoReloj();
      };

      if (conDesaceleracion && distancia > 1) {
        // Fase 1: recorre casi toda la distancia a velocidad pareja.
        const minutoIntermedio = minutoObjetivo - 1;
        this.tweens.add({
          targets: estado,
          minuto: minutoIntermedio,
          duration: 500,
          ease: 'Linear',
          onUpdate: avanzarEstado,
          onComplete: () => {
            // Fase 2 (los últimos ~600ms): más lenta, para el "momento de suspenso".
            this.tweens.add({
              targets: estado,
              minuto: minutoObjetivo,
              duration: 600,
              ease: 'Sine.easeOut',
              onUpdate: avanzarEstado,
              onComplete: () => {
                this.minutoActual = minutoObjetivo;
                this.actualizarTextoReloj();
                resolve();
              },
            });
          },
        });
      } else {
        // Recorrido normal, sin desaceleración: la duración depende de
        // cuántos minutos hay que recorrer (con un piso y un techo).
        const duracion = Phaser.Math.Clamp(distancia * 60, 200, 900);
        this.tweens.add({
          targets: estado,
          minuto: minutoObjetivo,
          duration: duracion,
          ease: 'Linear',
          onUpdate: avanzarEstado,
          onComplete: () => {
            this.minutoActual = minutoObjetivo;
            this.actualizarTextoReloj();
            resolve();
          },
        });
      }
    });
  }

  // -----------------------------------------------------------------------
  // Conexión con el motor: simulateMatch nos llama a estas funciones
  // -----------------------------------------------------------------------

  // manejarEvento es el callback onEvent que le pasamos a simulateMatch.
  // Es async: el motor espera (await) a que esta función termine antes de
  // generar el próximo evento, así que acá es donde controlamos el RITMO
  // del partido (mover el reloj, mostrar el texto, y hacer una pausa).
  async manejarEvento(evento) {
    // Si el jugador tiene abierto el panel de Formación o Cambios, nos
    // quedamos esperando acá (sin mover el reloj ni tocar el feed) hasta
    // que lo cierre. Así "pausamos" el partido igual que hace el panel de
    // decisión.
    if (this.promesaPausaAuxiliar) {
      await this.promesaPausaAuxiliar;
    }

    const conDesaceleracion = TIPOS_QUE_DESACELERAN.includes(evento.type);
    await this.animarRelojHasta(evento.minute, conDesaceleracion);

    if (evento.type === 'goal') {
      this.marcador[evento.team] += 1;
      this.actualizarTextoMarcador();
    }

    this.agregarLineaDeFeed(evento.text);

    await this.esperar(duracionDePausa(evento));
  }

  // manejarDecision es el callback onDecision: muestra el panel y no
  // resuelve hasta que el jugador clickea una opción.
  manejarDecision(decision) {
    return this.mostrarDecision(decision);
  }

  // iniciarPartido dispara la simulación completa. Como simulateMatch es
  // async, esta función también lo es: cuando el partido termina, resultado
  // trae el marcador final y la lista completa de eventos.
  async iniciarPartido() {
    const resultado = await simulateMatch(this.homeSquad, this.awaySquad, {
      onMatchReady: (matchState) => {
        // Guardamos la referencia para poder usarla desde los botones de
        // Formación y Cambios mientras el partido se sigue jugando.
        this.matchState = matchState;
        this.actualizarBotonFormacionTexto();
        this.actualizarBotonCambiosTexto();
      },
      onEvent: (evento) => this.manejarEvento(evento),
      onDecision: (decision) => this.manejarDecision(decision),
    });

    this.mostrarPantallaFinal(resultado);
  }

  // -----------------------------------------------------------------------
  // Pantalla final: marcador grande, relato completo scrolleable y botones
  // -----------------------------------------------------------------------

  mostrarPantallaFinal(resultado) {
    // El partido terminó: ocultamos los botones de Formación/Cambios, ya no
    // tiene sentido seguir tocándolos.
    this.botonFormacion.contenedor.setVisible(false);
    this.botonCambios.contenedor.setVisible(false);

    // Un fondo que tapa toda la pantalla, así lo que había del partido en
    // juego (feed, panel, etc.) queda debajo y no molesta visualmente.
    const contenedorFinal = this.add.container(0, 0);
    contenedorFinal.add(this.add.rectangle(0, 0, this.anchoPantalla, this.altoPantalla, 0x0d0d20, 0.98).setOrigin(0, 0));

    // Marcador final grande, con una animación de escala (aparece "creciendo").
    const textoFinal = this.add
      .text(this.anchoPantalla / 2, 70, `${resultado.marcadorFinal.home} - ${resultado.marcadorFinal.away}`, {
        fontFamily: 'Arial',
        fontSize: '48px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5)
      .setScale(0);
    contenedorFinal.add(textoFinal);

    this.tweens.add({
      targets: textoFinal,
      scale: 1,
      duration: 500,
      ease: 'Back.easeOut',
    });

    contenedorFinal.add(
      this.add
        .text(this.anchoPantalla / 2, 120, `${this.homeSquad.name} vs ${this.awaySquad.name}`, {
          fontFamily: 'Arial',
          fontSize: '16px',
          color: '#a0a0c0',
        })
        .setOrigin(0.5, 0.5)
    );

    // Lista scrolleable con el relato completo del partido (todos los eventos,
    // en orden, uno debajo del otro).
    const zonaListaY = 160;
    const zonaListaAlto = this.altoPantalla - zonaListaY - 90; // deja lugar abajo para los botones

    // "Máscara" invisible: recorta la lista para que no se vea texto por
    // fuera de su zona cuando hacemos scroll.
    const mascaraRectangulo = this.add
      .rectangle(this.anchoPantalla / 2, zonaListaY + zonaListaAlto / 2, this.anchoPantalla - 60, zonaListaAlto, 0xffffff)
      .setVisible(false);
    const mascara = mascaraRectangulo.createGeometryMask();

    const listaContainer = this.add.container(0, zonaListaY);
    listaContainer.setMask(mascara);
    contenedorFinal.add(listaContainer);

    resultado.eventos.forEach((evento, indice) => {
      const linea = this.add.text(40, indice * 26, `[${evento.minute}'] ${evento.text}`, {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#ffffff',
      });
      listaContainer.add(linea);
    });

    const altoContenidoLista = resultado.eventos.length * 26;
    const scrollMinY = Math.min(0, zonaListaAlto - altoContenidoLista);

    // Scroll con la rueda del mouse, igual que en CollectionScene.js.
    this.input.on('wheel', (_pointer, _gameObjects, _deltaX, deltaY) => {
      const nuevaY = listaContainer.y - deltaY;
      listaContainer.y = Phaser.Math.Clamp(nuevaY, zonaListaY + scrollMinY, zonaListaY);
    });

    // Botón "Siguiente partido": arma un rival nuevo (por ahora, de
    // mockCards) y reinicia esta misma escena para jugar contra él,
    // conservando el mismo equipo local.
    const botonSiguiente = this.crearBoton(this.anchoPantalla / 2 - 110, this.altoPantalla - 40, 190, 50, 'Siguiente partido', () => {
      const nuevoRival = armarRivalNuevo();
      this.scene.restart({ homeSquad: this.homeSquad, awaySquad: nuevoRival });
    });
    contenedorFinal.add(botonSiguiente);

    // Botón "Volver": vuelve a la colección de cartas.
    const botonVolver = this.crearBoton(this.anchoPantalla / 2 + 110, this.altoPantalla - 40, 190, 50, 'Volver', () => {
      this.scene.start('CollectionScene');
    });
    contenedorFinal.add(botonVolver);
  }
}
