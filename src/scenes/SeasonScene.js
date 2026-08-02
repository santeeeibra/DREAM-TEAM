// SeasonScene.js — pantalla que juega una temporada completa (liga de 38
// fechas) para el manager actual.
//
// No dibuja los 38 partidos uno por uno: usa seasonSimulator.js (motor de
// liga, lógica pura) para resolver toda la temporada de una, y eventSlots.js
// para sortear qué eventos de events_catalog le tocan en el camino. Esta
// escena solo se encarga de: traer los datos de Supabase (vía seasons.js),
// mostrarle al jugador los eventos para que elija una opción en cada uno, y
// después mostrar el resultado.
//
// Flujo, de punta a punta:
//   1. Cargar datos: rating del 11 titular, fila de `seasons` (se crea si
//      no existía), y sortear la lista de eventos de la temporada.
//   2. Preguntar "Simular rápido" o "Ver resumen" (con la preferencia
//      guardada en localStorage, pero siempre eligiendo de nuevo).
//   3. Ir mostrando cada evento sorteado, en orden, y esperar que el
//      jugador elija una opción. Cada elección se guarda en `season_events`
//      y acumula un efecto sobre moral/fatiga/dinero/rating.
//   4. Simular la temporada completa con simularTemporadaCompleta(),
//      arrancando moral/fatiga/rating desde lo que había en `seasons` más
//      lo que acumularon los eventos (ver aplicarEfectos: en vez de tratar
//      de "cortar" la temporada en tramos por cada evento, que complicaría
//      mucho el simulador, aplicamos el efecto acumulado como punto de
//      partida de toda la temporada).
//   5. Si el modo es "rápido", ir directo a la tabla final. Si es "ver
//      resumen", antes mostrar los momentosDestacados uno por uno.
//   6. Guardar el cierre de la temporada (`seasons` + el dinero del
//      manager).
//   7. Botón final: temporada siguiente (crea la fila de `seasons` N+1,
//      hereda moral/fatiga, y reinicia esta misma escena), o —si era la
//      temporada 8— pasa a CareerSummaryScene con el resumen de carrera.
import Phaser from 'phaser';
import { elegirEventosDeTemporada } from '../engine/eventSlots.js';
import { simularTemporadaCompleta } from '../engine/seasonSimulator.js';
import {
  actualizarMoneyManager,
  cerrarTemporada,
  crearSiguienteTemporada,
  getEventosActivos,
  getManagerParaTemporada,
  getOrCreateSeasonRow,
  guardarEventoResuelto,
  ratingDelOnceTitular,
} from '../seasons.js';

const ULTIMA_TEMPORADA = 8;

// Clave de localStorage donde se recuerda la última preferencia elegida
// ("rapido" o "resumen"). Es solo una preferencia recordada para próximas
// temporadas: la pantalla inicial siempre vuelve a mostrar los dos botones
// por si el jugador quiere cambiarla puntualmente esta vez.
const CLAVE_MODO_PREFERIDO = 'ut_temporada_modoPreferido';

const MS_POR_MOMENTO_DESTACADO = 1000;

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

    // contenedorDinamico es el único lugar donde se dibuja cada pantalla
    // del flujo (carga, elección de modo, evento a evento, momentos
    // destacados, tabla final): limpiarPantalla() lo vacía entero antes de
    // dibujar la siguiente, así nunca queda contenido viejo superpuesto.
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
      .text(anchoPantalla / 2, altoPantalla / 2 - 20, 'No se pudo cargar la temporada:\n' + error.message, {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#e74c3c',
        align: 'center',
        wordWrap: { width: anchoPantalla - 80 },
      })
      .setOrigin(0.5);

    const boton = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 + 60, 'Reintentar', {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#1a1a2e',
        backgroundColor: '#d4af37',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    boton.on('pointerdown', () => {
      this.mostrarCargando();
      this.cargarDatosYArrancar();
    });

    this.contenedorDinamico.add([texto, boton]);
  }

  // ---------------------------------------------------------------------
  // Paso 1: cargar todo lo que hace falta antes de mostrar nada interactivo.
  // ---------------------------------------------------------------------
  async cargarDatosYArrancar() {
    try {
      const manager = await getManagerParaTemporada(this.managerId);
      this.seasonNumber = this.seasonNumberSolicitado ?? manager.current_season;
      this.moneyInicial = manager.money;

      const [seasonRow, ratingBase, eventosActivos] = await Promise.all([
        getOrCreateSeasonRow(this.managerId, this.seasonNumber),
        ratingDelOnceTitular(this.managerId, this.seasonNumber),
        getEventosActivos(),
      ]);

      this.seasonRow = seasonRow;
      this.ratingBase = ratingBase;
      this.paradas = elegirEventosDeTemporada(eventosActivos);

      // Acumuladores de los efectos de los eventos de esta temporada:
      // arrancan en 0 y se les va sumando lo que aporte cada opción
      // elegida (ver aplicarEfectos). Se usan recién al final, como punto
      // de partida de simularTemporadaCompleta (ver correrSimulacionYFinalizar).
      this.moralAcumulada = 0;
      this.fatigaAcumulada = 0;
      this.moneyAcumulado = 0;
      this.ratingAcumulado = 0;

      this.mostrarPantallaInicial();
    } catch (error) {
      this.mostrarError(error);
    }
  }

  // ---------------------------------------------------------------------
  // Paso 2: elegir el modo de esta temporada ("Simular rápido" / "Ver
  // resumen"). Se recuerda en localStorage para la próxima vez, pero
  // siempre se pregunta de nuevo por si el jugador quiere cambiarla.
  // ---------------------------------------------------------------------
  mostrarPantallaInicial() {
    this.limpiarPantalla();
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;
    const modoPreferido = localStorage.getItem(CLAVE_MODO_PREFERIDO);

    const titulo = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 - 100, `Temporada ${this.seasonNumber}`, {
        fontFamily: 'Arial',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#d4af37',
      })
      .setOrigin(0.5);

    const subtitulo = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 - 60, '¿Cómo querés jugarla?', {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.contenedorDinamico.add([titulo, subtitulo]);

    const crearBotonModo = (modo, etiqueta, y) => {
      const esPreferido = modo === modoPreferido;
      const boton = this.add
        .text(anchoPantalla / 2, y, esPreferido ? `${etiqueta} ★` : etiqueta, {
          fontFamily: 'Arial',
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#1a1a2e',
          backgroundColor: '#d4af37',
          padding: { x: 20, y: 12 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      boton.on('pointerdown', () => this.elegirModo(modo));
      this.contenedorDinamico.add(boton);
    };

    crearBotonModo('rapido', 'Simular rápido', altoPantalla / 2 + 10);
    crearBotonModo('resumen', 'Ver resumen', altoPantalla / 2 + 70);
  }

  elegirModo(modo) {
    localStorage.setItem(CLAVE_MODO_PREFERIDO, modo);
    this.modoElegido = modo;
    this.resolverEventos();
  }

  // ---------------------------------------------------------------------
  // Paso 3: recorrer los eventos sorteados uno por uno, en orden de
  // matchday, esperando la elección del jugador en cada uno.
  // ---------------------------------------------------------------------
  async resolverEventos() {
    try {
      for (const parada of this.paradas) {
        const opcionElegida = await this.mostrarEventoYEsperarEleccion(parada);
        this.aplicarEfectos(opcionElegida.effects);

        const identificadorOpcion = opcionElegida.code ?? opcionElegida.label ?? opcionElegida.text ?? 'opcion';
        await guardarEventoResuelto(
          this.seasonRow.id,
          parada.evento.code,
          parada.matchday,
          identificadorOpcion,
          opcionElegida.effects ?? {}
        );
      }

      await this.correrSimulacionYFinalizar();
    } catch (error) {
      this.mostrarError(error);
    }
  }

  // aplicarEfectos suma los efectos de la opción elegida a los
  // acumuladores de la temporada. Formato esperado de `effects` (ver
  // events_catalog.options): { morale, fatigue, money, rating_efectivo },
  // todos opcionales (si un evento no toca alguno, simplemente no lo trae).
  aplicarEfectos(effects = {}) {
    this.moralAcumulada += effects.morale ?? 0;
    this.fatigaAcumulada += effects.fatigue ?? 0;
    this.moneyAcumulado += effects.money ?? 0;
    this.ratingAcumulado += effects.rating_efectivo ?? 0;
  }

  // mostrarEventoYEsperarEleccion pinta el modal de un evento (título +
  // descripción + 2-3 opciones) y devuelve una Promise que se resuelve
  // recién cuando el jugador toca una opción. Así resolverEventos() puede
  // simplemente "await" cada evento en orden, uno atrás del otro.
  mostrarEventoYEsperarEleccion(parada) {
    return new Promise((resolve) => {
      this.limpiarPantalla();
      const { evento, matchday } = parada;
      const anchoPantalla = this.scale.width;
      const altoPantalla = this.scale.height;

      const marco = this.add
        .rectangle(anchoPantalla / 2, altoPantalla / 2, anchoPantalla - 60, altoPantalla - 120, 0x0f1626, 0.97)
        .setStrokeStyle(2, 0xd4af37);
      this.contenedorDinamico.add(marco);

      const etiquetaFecha = this.add
        .text(anchoPantalla / 2, 90, `Fecha ${matchday}`, {
          fontFamily: 'Arial',
          fontSize: '12px',
          color: '#9aa5b8',
        })
        .setOrigin(0.5);

      const titulo = this.add
        .text(anchoPantalla / 2, 130, evento.title, {
          fontFamily: 'Arial',
          fontSize: '19px',
          fontStyle: 'bold',
          color: '#d4af37',
          align: 'center',
          wordWrap: { width: anchoPantalla - 110 },
        })
        .setOrigin(0.5);

      const descripcion = this.add
        .text(anchoPantalla / 2, 175, evento.description, {
          fontFamily: 'Arial',
          fontSize: '14px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: anchoPantalla - 110 },
        })
        .setOrigin(0.5, 0);

      this.contenedorDinamico.add([etiquetaFecha, titulo, descripcion]);

      const opciones = Array.isArray(evento.options) ? evento.options : [];
      const yInicial = altoPantalla / 2 + 60;
      opciones.forEach((opcion, indice) => {
        const boton = this.add
          .text(anchoPantalla / 2, yInicial + indice * 60, opcion.label ?? opcion.text ?? `Opción ${indice + 1}`, {
            fontFamily: 'Arial',
            fontSize: '15px',
            color: '#1a1a2e',
            backgroundColor: '#2ecc71',
            padding: { x: 18, y: 10 },
            align: 'center',
            wordWrap: { width: anchoPantalla - 160 },
          })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        boton.on('pointerdown', () => resolve(opcion));
        this.contenedorDinamico.add(boton);
      });
    });
  }

  // ---------------------------------------------------------------------
  // Paso 4: correr el motor de liga con moral/fatiga/rating ya ajustados
  // por los eventos, y decidir qué mostrar según el modo elegido.
  // ---------------------------------------------------------------------
  async correrSimulacionYFinalizar() {
    const moralInicial = Phaser.Math.Clamp(this.seasonRow.morale + this.moralAcumulada, 0, 100);
    const fatigaInicial = Phaser.Math.Clamp(this.seasonRow.fatigue + this.fatigaAcumulada, 0, 100);
    const ratingPlantel = Phaser.Math.Clamp(this.ratingBase + this.ratingAcumulado, 1, 99);

    const resumen = simularTemporadaCompleta({ ratingPlantel, moralInicial, fatigaInicial });
    this.resumenTemporada = resumen;

    // Guardamos el cierre apenas tenemos el resultado: no hace falta
    // esperar a que el jugador termine de ver momentos destacados para que
    // la temporada quede persistida en Supabase.
    await Promise.all([
      cerrarTemporada(this.seasonRow.id, resumen, resumen.moralFinal, resumen.fatigaFinal),
      actualizarMoneyManager(this.managerId, this.moneyInicial + this.moneyAcumulado),
    ]);

    if (this.modoElegido === 'rapido') {
      this.mostrarTablaFinal();
    } else {
      this.mostrarMomentosDestacados(resumen.momentosDestacados, 0);
    }
  }

  // ---------------------------------------------------------------------
  // Paso 5 (solo modo "resumen"): mostrar los momentosDestacados uno por
  // uno, con una pausa corta entre cada uno. Tocar la pantalla salta al
  // siguiente de inmediato (no hace falta esperar el segundo entero).
  // ---------------------------------------------------------------------
  mostrarMomentosDestacados(momentos, indice) {
    if (!momentos || indice >= momentos.length) {
      this.mostrarTablaFinal();
      return;
    }

    this.limpiarPantalla();
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;
    const momento = momentos[indice];

    const texto = this.add
      .text(anchoPantalla / 2, altoPantalla / 2, momento.descripcion, {
        fontFamily: 'Arial',
        fontSize: '17px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: anchoPantalla - 100 },
      })
      .setOrigin(0.5);

    const avisoSaltar = this.add
      .text(anchoPantalla / 2, altoPantalla - 40, 'Tocá para saltar', {
        fontFamily: 'Arial',
        fontSize: '11px',
        color: '#5a6478',
      })
      .setOrigin(0.5);

    this.contenedorDinamico.add([texto, avisoSaltar]);

    // La zona interactiva cubre toda la pantalla: tocar en cualquier lado
    // adelanta el momento destacado, sin esperar el temporizador de abajo.
    const zona = this.add.zone(0, 0, anchoPantalla, altoPantalla).setOrigin(0).setInteractive();
    this.contenedorDinamico.add(zona);

    const avanzar = () => {
      temporizador.remove(false);
      this.mostrarMomentosDestacados(momentos, indice + 1);
    };
    zona.on('pointerdown', avanzar);
    const temporizador = this.time.delayedCall(MS_POR_MOMENTO_DESTACADO, avanzar);
  }

  // ---------------------------------------------------------------------
  // Paso 6: tabla final de la temporada + botón para seguir.
  // ---------------------------------------------------------------------
  mostrarTablaFinal() {
    this.limpiarPantalla();
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;
    const r = this.resumenTemporada;

    const titulo = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 - 160, `Temporada ${this.seasonNumber} terminada`, {
        fontFamily: 'Arial',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#d4af37',
      })
      .setOrigin(0.5);

    const lineas = [
      `Posición final: ${r.league_position}°`,
      `Puntos: ${r.points}`,
      `${r.wins}V - ${r.draws}E - ${r.losses}D`,
      `Goles: ${r.goals_for} a favor / ${r.goals_against} en contra`,
    ];
    const textoStats = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 - 80, lineas.join('\n'), {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5, 0);

    this.contenedorDinamico.add([titulo, textoStats]);

    const esUltimaTemporada = this.seasonNumber >= ULTIMA_TEMPORADA;
    const boton = this.add
      .text(
        anchoPantalla / 2,
        altoPantalla / 2 + 140,
        esUltimaTemporada ? 'Ver resumen de carrera' : 'Siguiente temporada →',
        {
          fontFamily: 'Arial',
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#1a1a2e',
          backgroundColor: '#2ecc71',
          padding: { x: 18, y: 10 },
        }
      )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    boton.on('pointerdown', () => {
      if (esUltimaTemporada) {
        this.scene.start('CareerSummaryScene', { managerId: this.managerId });
        return;
      }
      this.confirmarSiguienteTemporada(boton);
    });

    this.contenedorDinamico.add(boton);
  }

  // ---------------------------------------------------------------------
  // Paso 7: crear la temporada siguiente (hereda moral/fatiga del cierre)
  // y reiniciar esta misma escena para jugarla.
  // ---------------------------------------------------------------------
  async confirmarSiguienteTemporada(boton) {
    boton.disableInteractive();
    boton.setText('Preparando...');

    try {
      const siguienteTemporada = await crearSiguienteTemporada(
        this.managerId,
        this.seasonNumber,
        this.resumenTemporada.moralFinal,
        this.resumenTemporada.fatigaFinal
      );
      this.scene.restart({ managerId: this.managerId, seasonNumber: siguienteTemporada.season_number });
    } catch (error) {
      this.mostrarError(error);
    }
  }
}
