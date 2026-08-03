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
//   4. Si el orquestador para en un evento (EVENT_TRIGGERED), por ahora
//      queda pendiente mostrarlo (ver TODO en avanzarSimulacion). Si la
//      temporada termina (SEASON_COMPLETE), se navega a CareerSummaryScene.
import Phaser from 'phaser';
import { TOTAL_MATCHDAYS, construirMomentosDestacados } from '../engine/seasonSimulator.js';
import { simularHastaProximoEvento, aplicarDecisionYContinuar } from '../engine/seasonOrchestrator.js';
import { calcularTablaFinal } from '../engine/leagueTable.js';
import * as careerState from '../state/careerState.js';
import { getLineup, getManagerCards } from '../lineups.js';
import {
  cerrarTemporada,
  crearSiguienteTemporada,
  getEventosActivos,
  getManagerParaTemporada,
  getOrCreateSeasonRow,
  ratingDelOnceTitular,
} from '../seasons.js';

// Clave de sessionStorage donde se guarda el `estado` de la temporada en
// curso después de cada tramo simulado. Permite retomarla si el jugador
// recarga la página a mitad de camino (ver init/create y avanzarSimulacion).
const CLAVE_ESTADO_TEMPORADA = 'dreamteam_season_estado';

// Misma última temporada que ULTIMA_TEMPORADA en src/dev/devActions.js: no
// se sincroniza automáticamente, si se cambia una hay que cambiar la otra.
const ULTIMA_TEMPORADA = 8;

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
// tramo y también al serializarse en sessionStorage.
const CANTIDAD_RIVALES = 19;
const RIVALES_SPREAD = 14;
const RIVALES_MIN = 40;
const RIVALES_MAX = 99;

function generarRivalesFuerza(ratingBase) {
  const rivales = [];
  for (let i = 0; i < CANTIDAD_RIVALES; i++) {
    const ruido = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    rivales.push(Math.round(Phaser.Math.Clamp(ratingBase + ruido * RIVALES_SPREAD, RIVALES_MIN, RIVALES_MAX)));
  }
  return rivales;
}

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
    console.error('[SeasonScene] Error preparando la temporada:', error);
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
        console.error('[SeasonScene] No se pudieron cargar las cartas para la colección:', errorCards);
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
        console.error('[SeasonScene] No se pudieron cargar las cartas para armar el 11:', error);
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

      console.log('[DEBUG] Eventos activos cargados:', eventosActivos);

      // Fallback mock: si la DB no tiene eventos cargados todavía, usamos
      // una lista temporal para que el orquestador encuentre eventos durante
      // la temporada y podamos probar el flujo narrativo.
      //
      // OJO con la estructura: eventSlots.js espera `min_matchday` (no
      // jornada_min) y `weight` (no probabilidad) para el sorteo ponderado.
      // El resto (id/titulo/descripcion/options) es lo que consume EventScene.
      if (!eventosActivos || eventosActivos.length === 0) {
        console.warn('[DEBUG] No hay eventos en la DB, usando fallback mock');
        this.eventosActivos = [
          {
            id: 'evento_prensa_1',
            titulo: 'Conferencia de Prensa picante',
            descripcion: 'Los periodistas cuestionan tu planteo táctico antes del clásico.',
            min_matchday: 1,
            weight: 10,
            options: [
              { id: 'opt_1', label: 'Responder con confianza', effects: { morale: 5 } },
              { id: 'opt_2', label: 'Evitar polémica', effects: { pressure: -5 } },
            ],
          },
          {
            id: 'evento_lesion_1',
            titulo: 'Lesión en entrenamiento',
            descripcion: 'Un titular se resintió en la práctica y es duda para la próxima fecha.',
            min_matchday: 5,
            weight: 5,
            options: [
              { id: 'opt_1', label: 'Darle descanso', effects: { morale: -3, fatigue: -10 } },
              { id: 'opt_2', label: 'Apretar los dientes', effects: { morale: 3, fatigue: 10 } },
            ],
          },
          {
            id: 'evento_derbi_1',
            titulo: 'Semana del derbi',
            descripcion: 'La ciudad entera habla del partido contra el rival histórico.',
            min_matchday: 25,
            weight: 10,
            options: [
              { id: 'opt_1', label: 'Motivar al equipo', effects: { morale: 8 } },
              { id: 'opt_2', label: 'Mantener la calma', effects: { pressure: -8 } },
            ],
          },
        ];
      } else {
        this.eventosActivos = eventosActivos;
      }

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
        });
      }

      this.mostrarPantallaInicial();
    } catch (error) {
      this.mostrarError(error);
    }
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

    const boton = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 + 30, 'Simular Temporada', {
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
  // actual del calendario (actualizarFechaEnPantalla la va refrescando).
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

    this.contenedorDinamico.add([titulo, this.textoFecha]);
    this.actualizarFechaEnPantalla(this.estado.jornadaActual);
  }

  actualizarFechaEnPantalla(jornadaActual) {
    if (this.textoFecha) {
      this.textoFecha.setText(`Fecha ${jornadaActual} / ${TOTAL_MATCHDAYS}`);
    }
  }

  // ---------------------------------------------------------------------
  // Loop principal: avanza la temporada tramo por tramo llamando al
  // orquestador, hasta que aparece un evento o se termina la temporada.
  //
  // decisionElegida solo se usa cuando quien llama viene de resolver un
  // evento pendiente (hoy nunca pasa: ver el TODO más abajo, todavía no hay
  // pantalla de evento que la produzca). El while(true) está escrito así a
  // propósito, aunque hoy corte siempre en la primera vuelta (los dos únicos
  // status que devuelve el orquestador cortan el loop): es la forma más
  // directa de leer "seguí llamando al orquestador hasta el próximo corte".
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
              eventosDisponibles: this.eventosActivos,
            })
          : simularHastaProximoEvento({
              estado: this.estado,
              rivalesFuerza: this.estado.rivalesFuerza,
              eventosDisponibles: this.eventosActivos,
            });
        decisionPendiente = null;

        // rivalesFuerza es un campo nuestro, no del orquestador: nos
        // aseguramos de que siga viajando en el estado para el próximo tramo.
        this.estado = { ...resultado.estado, rivalesFuerza: this.estado.rivalesFuerza };

        this.actualizarFechaEnPantalla(this.estado.jornadaActual);
        const paquete = {
          estadoOrquestador: this.estado,
          careerStateSnapshot: careerState.getState(),
        };
        sessionStorage.setItem(CLAVE_ESTADO_TEMPORADA, JSON.stringify(paquete));

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
}
