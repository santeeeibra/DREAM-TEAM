// SeasonScene.js — pantalla que juega una temporada completa (liga de 38
// fechas) para el manager actual.
//
// A diferencia de una versión anterior que resolvía todos los eventos de la
// temporada de una sola vez y recién después corría el motor de liga entero
// (simularTemporadaCompleta), esta escena usa seasonOrchestrator.js: avanza
// la temporada TRAMO a tramo, parando en cada evento que necesita una
// decisión del jugador. Eso es lo que permite mostrar el calendario
// avanzando fecha a fecha en vez de saltar directo al resultado final.
//
// Flujo, de punta a punta:
//   1. Cargar datos: rating del 11 titular, fila de `seasons` (se crea si
//      no existía) y el catálogo de eventos activos.
//   2. Retomar una temporada en curso desde sessionStorage si había una
//      (ver CLAVE_ESTADO_TEMPORADA), o arrancar el `estado` de cero.
//   3. Botón "Simular Temporada": dispara avanzarSimulacion(), que llama al
//      orquestador tramo por tramo hasta el próximo evento o el cierre de
//      la temporada, animando el número de fecha en pantalla en el camino.
//   4. Cuando un tramo vuelve con tramoStats, la pantalla muestra un
//      "ticker de scoreboard": los resultados del tramo (resultados[]) se
//      revelan uno por uno con ~250ms entre cada uno, y el contador de
//      puntos/record del HUD va sumando en vivo. Un tap/click en cualquier
//      momento corta el ticker y asienta el estado final del tramo de una.
//   5. Si el orquestador para en un evento (EVENT_TRIGGERED), después del
//      ticker se lanza EventScene con el dilema. Si la temporada termina
//      (SEASON_COMPLETE), se navega a CareerSummaryScene.
//
// Todo lo del ticker es 100% capa de presentación: los resultados ya llegan
// calculados en tramoStats.resultados, no se toca ni seasonOrchestrator.js
// ni seasonSimulator.js.
import Phaser from 'phaser';
import { TOTAL_MATCHDAYS, construirMomentosDestacados } from '../engine/seasonSimulator.js';
import { simularHastaProximoEvento, aplicarDecisionYContinuar, simularTemporadaConPlayoffs } from '../engine/seasonOrchestrator.js';
import { calcularTablaFinal } from '../engine/leagueTable.js';
import * as careerState from '../state/careerState.js';
import { getLineup } from '../data/lineupsRepo.js';
import { getManagerCards } from '../data/cardsRepo.js';
import {
  cerrarTemporada,
  crearSiguienteTemporada,
  getEventosActivos,
  getManagerParaTemporada,
  getOrCreateSeasonRow,
  ratingDelOnceTitular,
} from '../data/seasonsRepo.js';
import { ULTIMA_TEMPORADA } from '../core/constants.js';
import { generarRivalesFuerza, RIVALES_NOMBRES } from '../engine/rivals.js';
import { getLeagueById } from '../data/leagues.js';
import * as logger from '../core/logger.js';

// Clave de sessionStorage donde se guarda el `estado` de la temporada en
// curso después de cada tramo simulado. Permite retomarla si el jugador
// recarga la página a mitad de camino (ver init/create y avanzarSimulacion).
const CLAVE_ESTADO_TEMPORADA = 'dreamteam_season_estado';

// Delay entre cada resultado revelado por el ticker de scoreboard (~250ms,
// ver asentarTramoConTicker).
const DELAY_TICKER_MS = 250;

// Colores del scoreboard según el resultado de la fecha (win/draw/loss),
// en el mismo formato de color string '#RRGGBB' que usa Phaser.Text.
const COLOR_RESULTADO = {
  win: '#2ecc71',
  draw: '#d4af37',
  loss: '#e74c3c',
};

// esperar devuelve una Promise que resuelve después de `ms` milisegundos. Se
// usa para espaciar la revelación de resultados del ticker sin bloquear el
// loop de Phaser.
function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Generación de la liga de rivales de la temporada ---
//
// El orquestador (seasonOrchestrator.js) exige que TODOS los tramos de una
// misma temporada jueguen contra la MISMA lista de 19 fuerzas de rival (si
// no, simularTramo tira error a partir del segundo tramo). Pero el
// orquestador no genera ni guarda esa lista por su cuenta: es responsabilidad
// de quien lo llama. Por eso la generamos acá, UNA sola vez por temporada, y
// la llevamos colgada como estado.rivalesFuerza — un campo extra que el
// orquestador no conoce pero que le hace `{...estado}` en cada tramo (ver
// avanzar() en seasonOrchestrator.js), así que sobrevive intacto de tramo en
// tramo y también al serializarse en sessionStorage. La generación en sí
// vive en ../engine/rivals.js (generarRivalesFuerza). rivalesNombres viaja
// exactamente igual: es el pool fijo RIVALES_NOMBRES (mismo archivo), asignado
// una sola vez por temporada para que cada índice siga siendo el mismo club
// ficticio de tramo en tramo.

export class SeasonScene extends Phaser.Scene {
  constructor() {
    super('SeasonScene');
  }

  // data = { managerId, seasonNumber? }. seasonNumber es opcional: si no
  // viene, se usa managers.current_season (ver cargarDatosYArrancar).
  init(data) {
    this.managerId = data.managerId;
    this.seasonNumberSolicitado = data.seasonNumber ?? null;
  }

  create() {
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    this.add.rectangle(anchoPantalla / 2, altoPantalla / 2, anchoPantalla, altoPantalla, 0x1a1a2e);

    // contenedorDinamico es el único lugar donde se dibuja cada pantalla del
    // flujo (carga, botón de simular, calendario avanzando): limpiarPantalla()
    // lo vacía entero antes de dibujar la siguiente, así nunca queda
    // contenido viejo superpuesto.
    this.contenedorDinamico = this.add.container(0, 0);

    this.mostrarCargando();
    this.cargarDatosYArrancar();
  }

  limpiarPantalla() {
    this.contenedorDinamico.removeAll(true);
  }

  mostrarCargando() {
    this.limpiarPantalla();
    const texto = this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Cargando temporada...', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.contenedorDinamico.add(texto);
  }

  mostrarError(error) {
    logger.error('[SeasonScene] Error preparando la temporada:', error);
    this.limpiarPantalla();
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    const texto = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 - 40, 'No se pudo cargar la temporada:\n' + error.message, {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#e74c3c',
        align: 'center',
        wordWrap: { width: anchoPantalla - 80 },
      })
      .setOrigin(0.5);

    // "Reintentar" + "Volver a la colección": el error de carga nunca debe
    // dejar al jugador en un loop sin salida (el Reintentar de antes repetía
    // exactamente el mismo fallo y daba la sensación de pantalla congelada).
    const botonReintentar = this.add
      .text(anchoPantalla / 2 - 90, altoPantalla / 2 + 50, 'Reintentar', {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#1a1a2e',
        backgroundColor: '#d4af37',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    botonReintentar.on('pointerdown', () => {
      this.mostrarCargando();
      this.cargarDatosYArrancar();
    });

    const botonColeccion = this.add
      .text(anchoPantalla / 2 + 90, altoPantalla / 2 + 50, 'Volver a la colección', {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: '#3a4256',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    botonColeccion.on('pointerdown', async () => {
      try {
        const cards = await getManagerCards(this.managerId);
        this.scene.start('CollectionScene', { managerId: this.managerId, cards });
      } catch (errorCards) {
        logger.error('[SeasonScene] No se pudieron cargar las cartas para la colección:', errorCards);
      }
    });

    this.contenedorDinamico.add([texto, botonReintentar, botonColeccion]);
  }

  // ---------------------------------------------------------------------
  // Caso "todavía no hay 11 titular": en vez de fallar con un error (y dar
  // la sensación de pantalla congelada cuando el Reintentar repite el mismo
  // fallo), mostramos una pantalla con un botón que lleva directo a armar
  // el 11 (LineupScene). Cubre también los accesos directos a SeasonScene
  // (botón "Alinear Equipo" de la colección, dev action "Jugar temporada").
  // ---------------------------------------------------------------------
  mostrarSinLineup() {
    this.limpiarPantalla();
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    const texto = this.add
      .text(
        anchoPantalla / 2,
        altoPantalla / 2 - 40,
        'Todavía no tenés un 11 titular guardado\npara esta temporada.',
        {
          fontFamily: 'Arial',
          fontSize: '15px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: anchoPantalla - 80 },
        }
      )
      .setOrigin(0.5);

    const botonArmar = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 + 30, 'Armar mi 11 ▶', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#1a1a2e',
        backgroundColor: '#2ecc71',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    botonArmar.on('pointerdown', async () => {
      try {
        const cards = await getManagerCards(this.managerId);
        this.scene.start('LineupScene', {
          managerId: this.managerId,
          cards,
          seasonNumber: this.seasonNumber,
        });
      } catch (error) {
        logger.error('[SeasonScene] No se pudieron cargar las cartas para armar el 11:', error);
        this.mostrarError(error);
      }
    });

    this.contenedorDinamico.add([texto, botonArmar]);
  }

  // ---------------------------------------------------------------------
  // Paso 1: cargar todo lo que hace falta antes de mostrar nada interactivo,
  // y retomar la temporada en curso desde sessionStorage si la había.
  // ---------------------------------------------------------------------
  async cargarDatosYArrancar() {
    try {
      const manager = await getManagerParaTemporada(this.managerId);
      this.seasonNumber = this.seasonNumberSolicitado ?? manager.current_season;

      // El rating del 11 titular depende del lineup guardado: si el manager
      // todavía no confirmó un 11 para esta temporada, ratingDelOnceTitular
      // lanza (seasons.js). Para no dejar la pantalla congelada en ese caso,
      // leemos el lineup ANTES y, si no existe, derivamos al jugador a armar
      // el 11 (mostrarSinLineup) en lugar de tirar el error.
      const [seasonRow, lineup, eventosActivos] = await Promise.all([
        getOrCreateSeasonRow(this.managerId, this.seasonNumber),
        getLineup(this.managerId, this.seasonNumber),
        getEventosActivos(),
      ]);

      if (!lineup || !lineup.slots?.starters?.length) {
        this.seasonRow = seasonRow;
        this.mostrarSinLineup();
        return;
      }

      const ratingBase = await ratingDelOnceTitular(this.managerId, this.seasonNumber);

      this.eventosActivos = eventosActivos;

      this.seasonRow = seasonRow;

      const paqueteGuardado = sessionStorage.getItem(CLAVE_ESTADO_TEMPORADA);
      let careerStateSnapshot = null;
      if (paqueteGuardado) {
        const paquete = JSON.parse(paqueteGuardado);
        this.estado = paquete.estadoOrquestador;
        careerStateSnapshot = paquete.careerStateSnapshot;
      } else {
        this.estado = {
          ratingBase,
          moral: seasonRow.morale,
          fatiga: seasonRow.fatigue,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          points: 0,
          resultados: [],
          jornadaActual: 0,
          eventosDeTemporada: null,
          rivalesFuerza: generarRivalesFuerza(ratingBase),
          rivalesNombres: RIVALES_NOMBRES,
        };
      }

      // Precondición del orquestador: careerState tiene que estar cargado en
      // memoria antes de llamar a simularHastaProximoEvento/
      // aplicarDecisionYContinuar (usan getEffectiveRating, que lee de acá).
      //
      // Si veníamos de un F5 a mitad de temporada, rehidratamos careerState
      // con el snapshot completo guardado junto al estado del orquestador
      // (money/pressure/streak/ratingDelta), en vez de reconstruirlo de cero
      // a partir de seasonRow/manager — esos ya están desactualizados
      // respecto de lo que había en memoria antes del reload.
      if (careerStateSnapshot) {
        careerState.initCareerState(careerStateSnapshot);
      } else {
        careerState.initCareerState({
          managerId: this.managerId,
          seasonId: seasonRow.id,
          money: manager.money,
          morale: this.estado.moral,
          fatigue: this.estado.fatiga,
          pressure: seasonRow.pressure,
          streak: seasonRow.streak,
          reputation: manager.reputation ?? 50,
        });
      }

      this.mostrarPantallaInicial();
    } catch (error) {
      this.mostrarError(error);
    }
  }

  // ---------------------------------------------------------------------
  // calcularProximoRangoTramo deriva el rango de fechas que va a resolver el
  // próximo "Avanzar", usando la MISMA regla que usa seasonOrchestrator.js
  // para cortar tramos: desde la fecha siguiente a la actual hasta el
  // matchday del próximo evento (o el final de la liga si no queda ninguno).
  //
  // Es capa de presentación pura: no adelanta nada de la simulación, solo
  // replica la cuenta del corte para mostrar en el botón qué fechas se van
  // a jugar. En el primer tramo eventosDeTemporada todavía es null (el
  // sorteo recién pasa dentro de la primera llamada al orquestador), así que
  // lo único que se puede mostrar ahí es "1 a 38" — resultado correcto para
  // el caso común, se afina a partir del primer corte.
  // ---------------------------------------------------------------------
  calcularProximoRangoTramo() {
    const jornadaActual = this.estado?.jornadaActual ?? 0;
    const desdeJornada = jornadaActual + 1;

    let hastaJornada = TOTAL_MATCHDAYS;
    if (Array.isArray(this.estado?.eventosDeTemporada)) {
      const proximaParada = this.estado.eventosDeTemporada.find(
        (parada) => parada.matchday > jornadaActual
      );
      if (proximaParada) hastaJornada = proximaParada.matchday;
    }

    return { desdeJornada, hastaJornada };
  }

  // ---------------------------------------------------------------------
  // Paso 2: pantalla con el botón que dispara la simulación.
  // ---------------------------------------------------------------------
  mostrarPantallaInicial() {
    this.limpiarPantalla();
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    const titulo = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 - 80, `Temporada ${this.seasonNumber}`, {
        fontFamily: 'Arial',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#d4af37',
      })
      .setOrigin(0.5);

    const subtitulo = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 - 40, `Fecha ${this.estado.jornadaActual} / ${TOTAL_MATCHDAYS}`, {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.contenedorDinamico.add([titulo, subtitulo]);

    // El botón muestra por adelantado el rango de fechas que va a resolver:
    // deriva el próximo corte desde el estado (misma regla que el
    // orquestador) en vez de esperar a que el tramo ya esté simulado.
    const { desdeJornada, hastaJornada } = this.calcularProximoRangoTramo();
    const etiquetaBoton =
      desdeJornada === hastaJornada
        ? `Jugar fecha ${desdeJornada} →`
        : `Jugar fechas ${desdeJornada} a ${hastaJornada} →`;

    const boton = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 + 30, etiquetaBoton, {
        fontFamily: 'Arial',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#1a1a2e',
        backgroundColor: '#d4af37',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    boton.on('pointerdown', () => this.avanzarSimulacion());

    this.contenedorDinamico.add(boton);
  }

  // ---------------------------------------------------------------------
  // Paso 3: pantalla que se ve mientras se simulan tramos, con la fecha
  // actual del calendario (actualizarFechaEnPantalla la va refrescando), el
  // ticker de scoreboard en el centro y el HUD de puntos/record abajo.
  // ---------------------------------------------------------------------
  mostrarPantallaSimulando() {
    this.limpiarPantalla();
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    const titulo = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 - 40, `Temporada ${this.seasonNumber}`, {
        fontFamily: 'Arial',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#d4af37',
      })
      .setOrigin(0.5);

    this.textoFecha = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 + 10, '', {
        fontFamily: 'Arial',
        fontSize: '17px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Ticker de scoreboard: texto central que se va reemplazando con cada
    // resultado revelado ("Fecha X — vs Rival — 2-1"). Arranca vacío y se
    // llena desde asentarTramoConTicker.
    this.textoTicker = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 + 55, '', {
        fontFamily: 'Arial',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: anchoPantalla - 80 },
      })
      .setOrigin(0.5);

    // HUD de puntos/record: contadores que van sumando en vivo con cada
    // resultado revelado. Arrancan con los totales vigentes al mostrar la
    // pantalla (el estado pre-tramo de la iteración actual).
    if (this.estado) {
      this.puntosHUD = this.estado.points ?? 0;
      this.winsHUD = this.estado.wins ?? 0;
      this.drawsHUD = this.estado.draws ?? 0;
      this.lossesHUD = this.estado.losses ?? 0;
    } else {
      this.puntosHUD = 0;
      this.winsHUD = 0;
      this.drawsHUD = 0;
      this.lossesHUD = 0;
    }

    this.textoPuntosHUD = this.add
      .text(anchoPantalla / 2, altoPantalla - 80, `Puntos: ${this.puntosHUD}`, {
        fontFamily: 'Arial',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#d4af37',
      })
      .setOrigin(0.5);

    this.textoRecordHUD = this.add
      .text(anchoPantalla / 2, altoPantalla - 48, `${this.winsHUD}G ${this.drawsHUD}E ${this.lossesHUD}P`, {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Footer de corte: Moral/Fatiga al final del tramo. Se deja vacío y solo
    // se rellena cuando el ticker termina (o se corta) y se asienta el estado
    // final del tramo.
    this.textoFooterCorte = this.add
      .text(anchoPantalla / 2, altoPantalla - 16, '', {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#9aa0b4',
      })
      .setOrigin(0.5);

    this.contenedorDinamico.add([
      titulo,
      this.textoFecha,
      this.textoTicker,
      this.textoPuntosHUD,
      this.textoRecordHUD,
      this.textoFooterCorte,
    ]);
    this.actualizarFechaEnPantalla(this.estado.jornadaActual);
  }

  actualizarFechaEnPantalla(jornadaActual) {
    if (this.textoFecha) {
      this.textoFecha.setText(`Fecha ${jornadaActual} / ${TOTAL_MATCHDAYS}`);
    }
  }

  // ---------------------------------------------------------------------
  // asentarTramoConTicker "revela" los resultados de un tramo uno por uno en
  // el HUD antes de dejar asentado el estado final, sin tocar la lógica de
  // simulación (los resultados ya vienen calculados en tramoStats).
  //
  // - Por cada resultado de tramoStats.resultados espera DELAY_TICKER_MS y
  //   pinta en this.textoTicker "Fecha {jornada} — vs {rivalNombre} —
  //   {golesPlantel}-{golesRival}" con el color del resultado
  //   (win/draw/loss).
  // - En paralelo suma en vivo el contador de puntos (3/1/0) y el record
  //   (G/E/P) del HUD, partiendo del snapshot pre-tramo que pasa el caller
  //   (antes de pisar this.estado con el estado post-tramo).
  // - Un tap/click en cualquier punto corta el ticker: se asienta directo el
  //   estado final (puntos/record totales + footer Moral/Fatiga del corte).
  //
  // Estados del HUD que maneja:
  //   - this.puntosHUD / winsHUD / drawsHUD / lossesHUD: contadores en vivo.
  //   - this.textoTicker: última línea revelada del scoreboard.
  //   - this.textoFooterCorte: "Moral X | Fatiga Y" al asentar el tramo.
  // ---------------------------------------------------------------------
  async asentarTramoConTicker(tramoStats, estadoPreTramo) {
    const resultados = tramoStats?.resultados ?? [];
    const corte = tramoStats ?? {};
    // Totales ACUMULADOS de la temporada al corte: this.estado ya quedó
    // pisado con el estado post-tramo antes de llamarnos. OJO con no usar
    // tramoStats.points/wins/draws/losses acá: esos son los DELTAS del tramo
    // (estadoDespues - estadoAntes), no los totales que muestra el HUD.
    const totalesAlCorte = {
      points: this.estado?.points ?? this.puntosHUD,
      wins: this.estado?.wins ?? this.winsHUD,
      draws: this.estado?.draws ?? this.drawsHUD,
      losses: this.estado?.losses ?? this.lossesHUD,
    };

    this.tickerCortado = false;
    this.puntosHUD = estadoPreTramo?.points ?? 0;
    this.winsHUD = estadoPreTramo?.wins ?? 0;
    this.drawsHUD = estadoPreTramo?.draws ?? 0;
    this.lossesHUD = estadoPreTramo?.losses ?? 0;

    // Tap/click durante la animación: corta el ticker y salta directo a
    // asentar el estado final del tramo.
    const desregistrarClick = () => {
      if (this.handlerCorteTicker) {
        this.input.off('pointerdown', this.handlerCorteTicker);
        this.handlerCorteTicker = null;
      }
    };
    this.handlerCorteTicker = () => {
      this.tickerCortado = true;
    };
    this.input.on('pointerdown', this.handlerCorteTicker);

    try {
      for (const resultado of resultados) {
        if (this.tickerCortado) break;
        await esperar(DELAY_TICKER_MS);
        if (this.tickerCortado) break;

        const textoResultado = `Fecha ${resultado.jornada} — vs ${resultado.rivalNombre ?? 'Rival'} — ${resultado.golesPlantel}-${resultado.golesRival}`;
        const colorResultado = COLOR_RESULTADO[resultado.resultado] ?? '#ffffff';
        this.textoTicker?.setText(textoResultado).setColor(colorResultado);

        // Suma en vivo del contador. La fuente de verdad para el resultado
        // es el propio campo `resultado` ('win'/'draw'/'loss') — el mismo
        // criterio que ya usó seasonSimulator.js para calcular el tramo.
        if (resultado.resultado === 'win') {
          this.puntosHUD += 3;
          this.winsHUD += 1;
        } else if (resultado.resultado === 'draw') {
          this.puntosHUD += 1;
          this.drawsHUD += 1;
        } else {
          this.lossesHUD += 1;
        }
        this.actualizarHUD();
      }

      // Al asentar (ticker completo o cortado) los contadores quedan en los
      // totales acumulados de la temporada y aparece el footer moral/fatiga
      // del corte. Si el ticker se cortó a la mitad, este paso es el que
      // salta directo al estado final del tramo.
      this.puntosHUD = totalesAlCorte.points;
      this.winsHUD = totalesAlCorte.wins;
      this.drawsHUD = totalesAlCorte.draws;
      this.lossesHUD = totalesAlCorte.losses;
      this.actualizarHUD();

      if (this.textoFooterCorte) {
        this.textoFooterCorte.setText(
          `Moral ${corte.moralAlCorte ?? '—'} | Fatiga ${corte.fatigaAlCorte ?? '—'}`
        );
      }
    } finally {
      desregistrarClick();
    }
  }

  actualizarHUD() {
    if (this.textoPuntosHUD) this.textoPuntosHUD.setText(`Puntos: ${this.puntosHUD}`);
    if (this.textoRecordHUD) this.textoRecordHUD.setText(`${this.winsHUD}G ${this.drawsHUD}E ${this.lossesHUD}P`);
  }

  // ---------------------------------------------------------------------
  // Loop principal: avanza la temporada tramo por tramo llamando al
  // orquestador, hasta que aparece un evento o se termina la temporada.
  //
  // decisionElegida solo se usa cuando quien llama viene de resolver un
  // evento pendiente (ver el manejo de EVENT_TRIGGERED más abajo: EventScene
  // resuelve con la opción elegida y el loop continúa con esa decisión). El
  // while(true) está escrito así a propósito, aunque hoy corte siempre en la
  // primera vuelta (los dos únicos status que devuelve el orquestador cortan
  // el loop): es la forma más directa de leer "seguí llamando al orquestador
  // hasta el próximo corte".
  // ---------------------------------------------------------------------
  async avanzarSimulacion(decisionElegida = null) {
    this.mostrarPantallaSimulando();

    try {
      let decisionPendiente = decisionElegida;

      while (true) {
        const resultado = decisionPendiente
          ? aplicarDecisionYContinuar({
              estado: this.estado,
              decisionElegida: decisionPendiente,
              rivalesFuerza: this.estado.rivalesFuerza,
              rivalesNombres: this.estado.rivalesNombres,
              eventosDisponibles: this.eventosActivos,
            })
          : simularHastaProximoEvento({
              estado: this.estado,
              rivalesFuerza: this.estado.rivalesFuerza,
              rivalesNombres: this.estado.rivalesNombres,
              eventosDisponibles: this.eventosActivos,
            });
        decisionPendiente = null;

        // Snapshot de los contadores PRE-tramo. Hay que capturarlo ANTES de
        // pisar this.estado con el estado post-tramo: el ticker suma desde
        // esta base para mostrar los puntos/record acumulándose en vivo.
        const estadoPreTramo = {
          wins: this.estado.wins,
          draws: this.estado.draws,
          losses: this.estado.losses,
          points: this.estado.points,
        };

        // rivalesFuerza/rivalesNombres son campos nuestros, no del
        // orquestador: nos aseguramos de que sigan viajando en el estado para
        // el próximo tramo.
        this.estado = {
          ...resultado.estado,
          rivalesFuerza: this.estado.rivalesFuerza,
          rivalesNombres: this.estado.rivalesNombres,
        };

        this.actualizarFechaEnPantalla(this.estado.jornadaActual);
        const paquete = {
          estadoOrquestador: this.estado,
          careerStateSnapshot: careerState.getState(),
        };
        sessionStorage.setItem(CLAVE_ESTADO_TEMPORADA, JSON.stringify(paquete));

        // Antes de avanzar al evento o al resumen final, revelamos los
        // resultados del tramo con el ticker de scoreboard.
        await this.asentarTramoConTicker(resultado.tramoStats, estadoPreTramo);

        if (resultado.status === 'EVENT_TRIGGERED') {
          // resultado.eventDetails es la parada que arma eventSlots.js:
          // { slot, matchday, evento }. EventScene espera el evento real del
          // catálogo (titulo/descripcion/options), así que le pasamos
          // .evento, no la parada completa.
          const nuevaDecision = await new Promise((resolve) => {
            this.scene.launch('EventScene', {
              eventDetails: resultado.eventDetails.evento,
              onResolve: resolve,
            });
          });
          decisionPendiente = nuevaDecision;
          continue;
        }

        if (resultado.status === 'SEASON_COMPLETE') {
          sessionStorage.removeItem(CLAVE_ESTADO_TEMPORADA);

          const { tabla, posicionJugador } = calcularTablaFinal({
            rivalesFuerza: this.estado.rivalesFuerza,
            resultadosJugador: this.estado.resultados,
          });
          const momentosDestacados = construirMomentosDestacados(this.estado.resultados);

          const resumen = {
            wins: this.estado.wins,
            draws: this.estado.draws,
            losses: this.estado.losses,
            goals_for: this.estado.goalsFor,
            goals_against: this.estado.goalsAgainst,
            points: this.estado.points,
            league_position: posicionJugador,
          };
          const { morale: moralFinal, fatigue: fatigaFinal } = careerState.getState();
          await cerrarTemporada(this.seasonRow.id, resumen, moralFinal, fatigaFinal);

          const esUltimaTemporada = this.seasonNumber === ULTIMA_TEMPORADA;
          if (!esUltimaTemporada) {
            const { pressureInicial, moraleInicial, fatigueInicial, streakInicial } =
              careerState.calcularResetParcialTemporada();
            await crearSiguienteTemporada(
              this.managerId,
              this.seasonNumber,
              moraleInicial,
              fatigueInicial,
              pressureInicial,
              streakInicial
            );
          }

          this.scene.start('CareerSummaryScene', {
            managerId: this.managerId,
            league_position: posicionJugador,
            tablaCompleta: tabla,
            momentosDestacados,
            seasonNumber: this.seasonNumber,
            esUltimaTemporada,
          });
          break;
        }
      }
    } catch (error) {
      this.mostrarError(error);
    }
  }

  // ---------------------------------------------------------------------
  // Pantallas de Play-offs
  // ---------------------------------------------------------------------

  /**
   * Muestra la tabla de zonas al finalizar la fase regular
   * @param {Object} tablasZonas - { zonaA: [...], zonaB: [...] }
   * @param {string} zonaJugador - 'A' o 'B'
   * @param {number} posicionJugador - Posición en su zona
   */
  mostrarTablaZonas(tablasZonas, zonaJugador, posicionJugador) {
    this.limpiarPantalla();
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    const titulo = this.add
      .text(anchoPantalla / 2, 60, 'Fase Regular Finalizada', {
        fontFamily: 'Arial',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#d4af37',
      })
      .setOrigin(0.5);

    const subtitulo = this.add
      .text(anchoPantalla / 2, 95, `Tu zona: Zona ${zonaJugador} — Posición: ${posicionJugador}°`, {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Mostrar tabla de la zona del jugador
    const tabla = tablasZonas[`zona${zonaJugador}`] || [];
    const yInicio = 140;
    const altoFila = 24;

    tabla.slice(0, 10).forEach((equipo, idx) => {
      const pos = idx + 1;
      const esJugador = equipo.esJugador;
      const clasificado = pos <= 8;

      const color = esJugador ? '#d4af37' : clasificado ? '#2ecc71' : '#ffffff';
      const bgColor = esJugador ? 0x2c2c3e : clasificado ? 0x1e3a28 : 0x1a1a2e;

      // Fondo de fila
      this.add.rectangle(anchoPantalla / 2, yInicio + idx * altoFila, anchoPantalla - 60, altoFila - 2, bgColor);

      // Texto de posición y equipo
      const textoFila = this.add
        .text(
          60,
          yInicio + idx * altoFila,
          `${pos}. ${equipo.nombre}  ${equipo.puntos}pts  ${equipo.gf}-${equipo.gc}`,
          {
            fontFamily: 'Arial',
            fontSize: '14px',
            color,
            fontStyle: esJugador ? 'bold' : 'normal',
          }
        )
        .setOrigin(0, 0.5);

      this.contenedorDinamico.add(textoFila);
    });

    const leyenda = this.add
      .text(anchoPantalla / 2, yInicio + 10 * altoFila + 20, 'Los 8 primeros clasifican a Play-offs', {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#2ecc71',
      })
      .setOrigin(0.5);

    const botonContinuar = this.add
      .text(anchoPantalla / 2, altoPantalla - 60, 'Continuar →', {
        fontFamily: 'Arial',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#1a1a2e',
        backgroundColor: '#d4af37',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    botonContinuar.on('pointerdown', () => {
      this.continuarDespuesDeTabla();
    });

    this.contenedorDinamico.add([titulo, subtitulo, leyenda, botonContinuar]);
  }

  /**
   * Pantalla de clasificación o eliminación
   * @param {boolean} clasificado - true si clasificó a playoffs
   * @param {number} posicion - Posición final en la zona
   */
  mostrarClasificacionOEliminacion(clasificado, posicion) {
    this.limpiarPantalla();
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    if (clasificado) {
      const titulo = this.add
        .text(anchoPantalla / 2, altoPantalla / 2 - 60, '¡Clasificaste a los Play-offs!', {
          fontFamily: 'Arial',
          fontSize: '26px',
          fontStyle: 'bold',
          color: '#2ecc71',
        })
        .setOrigin(0.5);

      const subtitulo = this.add
        .text(anchoPantalla / 2, altoPantalla / 2 - 10, `Posición: ${posicion}° en tu zona`, {
          fontFamily: 'Arial',
          fontSize: '16px',
          color: '#ffffff',
        })
        .setOrigin(0.5);

      const boton = this.add
        .text(anchoPantalla / 2, altoPantalla / 2 + 50, 'Jugar Play-offs →', {
          fontFamily: 'Arial',
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#1a1a2e',
          backgroundColor: '#2ecc71',
          padding: { x: 20, y: 12 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      boton.on('pointerdown', () => {
        this.iniciarPlayoffs();
      });

      this.contenedorDinamico.add([titulo, subtitulo, boton]);
    } else {
      const titulo = this.add
        .text(anchoPantalla / 2, altoPantalla / 2 - 60, 'Quedaste eliminado', {
          fontFamily: 'Arial',
          fontSize: '26px',
          fontStyle: 'bold',
          color: '#e74c3c',
        })
        .setOrigin(0.5);

      const subtitulo = this.add
        .text(anchoPantalla / 2, altoPantalla / 2 - 10, `Posición final: ${posicion}° en tu zona`, {
          fontFamily: 'Arial',
          fontSize: '16px',
          color: '#ffffff',
        })
        .setOrigin(0.5);

      const mensaje = this.add
        .text(anchoPantalla / 2, altoPantalla / 2 + 20, 'No clasificaste a los Play-offs', {
          fontFamily: 'Arial',
          fontSize: '14px',
          color: '#9aa0b4',
        })
        .setOrigin(0.5);

      const boton = this.add
        .text(anchoPantalla / 2, altoPantalla / 2 + 70, 'Ver resumen de temporada →', {
          fontFamily: 'Arial',
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#1a1a2e',
          backgroundColor: '#e74c3c',
          padding: { x: 20, y: 12 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      boton.on('pointerdown', () => {
        this.finalizarTemporadaSinPlayoffs();
      });

      this.contenedorDinamico.add([titulo, subtitulo, mensaje, boton]);
    }
  }

  /**
   * Muestra el bracket de play-offs con los emparejamientos actuales
   * @param {Object} faseActual - { nombre: 'Octavos', partidos: [...] }
   */
  mostrarBracketPlayoffs(faseActual) {
    this.limpiarPantalla();
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    const titulo = this.add
      .text(anchoPantalla / 2, 50, `Play-offs — ${faseActual.nombre}`, {
        fontFamily: 'Arial',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#d4af37',
      })
      .setOrigin(0.5);

    const yInicio = 120;
    const altoPartido = 60;

    faseActual.partidos.forEach((partido, idx) => {
      const yPos = yInicio + idx * altoPartido;

      // Nombres de equipos
      const local = this.add
        .text(anchoPantalla / 2 - 80, yPos, partido.local, {
          fontFamily: 'Arial',
          fontSize: '14px',
          color: partido.esJugadorLocal ? '#d4af37' : '#ffffff',
          fontStyle: partido.esJugadorLocal ? 'bold' : 'normal',
        })
        .setOrigin(1, 0.5);

      const vs = this.add
        .text(anchoPantalla / 2, yPos, 'vs', {
          fontFamily: 'Arial',
          fontSize: '12px',
          color: '#9aa0b4',
        })
        .setOrigin(0.5);

      const visitante = this.add
        .text(anchoPantalla / 2 + 80, yPos, partido.visitante, {
          fontFamily: 'Arial',
          fontSize: '14px',
          color: partido.esJugadorVisitante ? '#d4af37' : '#ffffff',
          fontStyle: partido.esJugadorVisitante ? 'bold' : 'normal',
        })
        .setOrigin(0, 0.5);

      // Resultado si ya se jugó
      if (partido.resultado) {
        const resultado = this.add
          .text(anchoPantalla / 2, yPos + 20, partido.resultado, {
            fontFamily: 'Arial',
            fontSize: '13px',
            color: '#2ecc71',
          })
          .setOrigin(0.5);
        this.contenedorDinamico.add(resultado);
      }

      this.contenedorDinamico.add([local, vs, visitante]);
    });

    const botonSimular = this.add
      .text(anchoPantalla / 2, altoPantalla - 60, 'Simular fase →', {
        fontFamily: 'Arial',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#1a1a2e',
        backgroundColor: '#d4af37',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    botonSimular.on('pointerdown', () => {
      this.simularFasePlayoffs(faseActual.nombre);
    });

    this.contenedorDinamico.add([titulo, botonSimular]);
  }

  /**
   * Pantalla de campeón de play-offs
   */
  mostrarCampeon() {
    this.limpiarPantalla();
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    const titulo = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 - 80, '¡CAMPEÓN!', {
        fontFamily: 'Arial',
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#d4af37',
      })
      .setOrigin(0.5);

    const subtitulo = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 - 20, 'Ganaste la Liga Profesional', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#2ecc71',
      })
      .setOrigin(0.5);

    const boton = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 + 60, 'Ver resumen →', {
        fontFamily: 'Arial',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#1a1a2e',
        backgroundColor: '#d4af37',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    boton.on('pointerdown', () => {
      this.finalizarTemporadaConCampeonato();
    });

    this.contenedorDinamico.add([titulo, subtitulo, boton]);
  }

  // ---------------------------------------------------------------------
  // Métodos auxiliares para play-offs (stubs - implementar lógica)
  // ---------------------------------------------------------------------

  continuarDespuesDeTabla() {
    // TODO: Verificar si clasificó y llamar a mostrarClasificacionOEliminacion
    logger.log('[SeasonScene] continuarDespuesDeTabla - stub');
  }

  iniciarPlayoffs() {
    // TODO: Iniciar simulación de play-offs y mostrar bracket
    logger.log('[SeasonScene] iniciarPlayoffs - stub');
  }

  simularFasePlayoffs(nombreFase) {
    // TODO: Simular la fase actual y avanzar
    logger.log('[SeasonScene] simularFasePlayoffs:', nombreFase);
  }

  finalizarTemporadaSinPlayoffs() {
    // TODO: Cerrar temporada sin campeonato
    logger.log('[SeasonScene] finalizarTemporadaSinPlayoffs - stub');
  }

  finalizarTemporadaConCampeonato() {
    // TODO: Cerrar temporada como campeón
    logger.log('[SeasonScene] finalizarTemporadaConCampeonato - stub');
  }
}