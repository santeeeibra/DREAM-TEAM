// CareerSummaryScene.js — pantalla de resumen de carrera: se llega acá
// cuando el manager termina la última temporada (ver ULTIMA_TEMPORADA en
// src/core/constants.js). Trae TODAS las filas de `seasons` de ese manager y
// muestra, temporada por temporada, cómo le fue, más un resumen agregado
// de toda la carrera.
//
// Es la última pantalla del flujo: desde acá la única acción posible es
// "Nueva carrera", que borra el manager entero (mismo criterio que
// resetearCuenta() del panel de dev, ver src/dev/devActions.js) para
// empezar de cero.
import Phaser from 'phaser';
import { getManagerById, borrarManager } from '../data/managersRepo.js';
import { getTemporadasDeManager } from '../data/seasonsRepo.js';
import { getManagerCards } from '../data/cardsRepo.js';
import * as logger from '../core/logger.js';

// Franja fija de arriba (nombre del DT + club/liga), no se mueve con el
// scroll. Mismo criterio que CollectionScene: solo el contenido de abajo
// (contenidoContainer) se desplaza, el header queda siempre visible.
const ALTO_HEADER = 80;
const MARGEN_SUPERIOR = 20;
const ALTO_FILA_TEMPORADA = 44;

export class CareerSummaryScene extends Phaser.Scene {
  constructor() {
    super('CareerSummaryScene');
  }

  init(data) {
    this.managerId = data.managerId;
    // Datos de la temporada recién completada, mandados por SeasonScene al
    // navegar acá (ver avanzarSimulacion/SEASON_COMPLETE en SeasonScene.js).
    // Pueden venir undefined si la escena se abre en un flujo viejo de
    // testing que todavía no los manda: cada consumo de abajo cae a "—".
    this.leaguePosition = data.league_position;
    this.tablaCompleta = data.tablaCompleta;
    this.momentosDestacados = data.momentosDestacados;
    // Datos de modo, mandados por SeasonScene para distinguir fin de
    // temporada (hay más temporadas por jugar) de fin de carrera. Default
    // a true a propósito: el panel de dev abre esta escena sin mandar estos
    // dos campos, y debe seguir viendo el resumen de carrera completo de
    // siempre.
    this.seasonNumber = data.seasonNumber ?? null;
    this.esUltimaTemporada = data.esUltimaTemporada ?? true;
  }

  create() {
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    this.add.rectangle(anchoPantalla / 2, altoPantalla / 2, anchoPantalla, altoPantalla, 0x1a1a2e);

    // contenedorDinamico es el único lugar donde se dibuja cada estado de
    // esta pantalla (carga, error, resumen): limpiarPantalla() lo vacía
    // entero antes de dibujar el siguiente.
    this.contenedorDinamico = this.add.container(0, 0);

    this.mostrarCargando();
    this.cargarDatosYMostrar();
  }

  limpiarPantalla() {
    this.contenedorDinamico.removeAll(true);
  }

  mostrarCargando() {
    this.limpiarPantalla();
    const texto = this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Cargando resumen de carrera...', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.contenedorDinamico.add(texto);
  }

  mostrarError(error) {
    logger.error('[CareerSummaryScene] Error cargando el resumen de carrera:', error);
    this.limpiarPantalla();
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    const texto = this.add
      .text(anchoPantalla / 2, altoPantalla / 2 - 20, 'No se pudo cargar el resumen de carrera:\n' + error.message, {
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
      this.cargarDatosYMostrar();
    });

    this.contenedorDinamico.add([texto, boton]);
  }

  async cargarDatosYMostrar() {
    try {
      const [manager, temporadas] = await Promise.all([
        getManagerById(this.managerId),
        getTemporadasDeManager(this.managerId),
      ]);
      this.manager = manager;
      this.temporadas = temporadas;
      this.mostrarResumen();
    } catch (error) {
      this.mostrarError(error);
    }
  }

  // ---------------------------------------------------------------------
  // Header fijo: nombre del DT + club/liga.
  // ---------------------------------------------------------------------
  crearHeader(anchoPantalla) {
    this.add.rectangle(anchoPantalla / 2, ALTO_HEADER / 2, anchoPantalla, ALTO_HEADER, 0x1a1a2e).setDepth(10);
    this.add
      .rectangle(anchoPantalla / 2, ALTO_HEADER, anchoPantalla, 2, 0xd4af37)
      .setOrigin(0.5, 0)
      .setDepth(10);

    this.add
      .text(anchoPantalla / 2, 16, this.manager.name, {
        fontFamily: 'Arial',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#d4af37',
      })
      .setOrigin(0.5, 0)
      .setDepth(11);

    this.add
      .text(anchoPantalla / 2, 46, `${this.manager.club} · ${this.manager.league}`, {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5, 0)
      .setDepth(11);
  }

  // nombresDeTrofeos: `trophies` es jsonb, guardado como { clave: valor }
  // por cada título ganado esa temporada (el motor de liga todavía no lo
  // completa, así que hoy suele venir vacío/null). Iteramos sus keys y las
  // pasamos de snake_case a texto legible, sin asumir un set fijo de claves.
  nombresDeTrofeos(trophies) {
    const claves = Object.keys(trophies ?? {});
    if (claves.length === 0) return null;
    return claves.map((clave) => clave.replaceAll('_', ' '));
  }

  // ---------------------------------------------------------------------
  // Dispatcher: fin de carrera (última temporada) vs. fin de temporada
  // (quedan más temporadas por jugar). Ver esUltimaTemporada en init().
  // ---------------------------------------------------------------------
  mostrarResumen() {
    if (this.esUltimaTemporada) {
      this.mostrarResumenCarrera();
    } else {
      this.mostrarResumenTemporada();
    }
  }

  // ---------------------------------------------------------------------
  // Contenido scrolleable: una fila por temporada + el resumen agregado +
  // el botón de "Nueva carrera".
  // ---------------------------------------------------------------------
  mostrarResumenCarrera() {
    this.limpiarPantalla();
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    this.crearHeader(anchoPantalla);

    this.contenidoContainer = this.add.container(0, ALTO_HEADER);
    this.contenedorDinamico.add(this.contenidoContainer);

    let y = MARGEN_SUPERIOR;

    if (this.temporadas.length === 0) {
      const texto = this.add
        .text(anchoPantalla / 2, y + 20, 'Todavía no jugaste ninguna temporada.', {
          fontFamily: 'Arial',
          fontSize: '14px',
          color: '#aaaaaa',
        })
        .setOrigin(0.5, 0);
      this.contenidoContainer.add(texto);
      y += 60;
    } else {
      this.contenidoContainer.add(
        this.add
          .text(24, y, 'TEMPORADAS', {
            fontFamily: 'Arial',
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#9aa5b8',
          })
          .setOrigin(0, 0)
      );
      y += 26;

      for (const temporada of this.temporadas) {
        y = this.dibujarFilaTemporada(temporada, y, anchoPantalla);
      }
    }

    y += 10;
    y = this.dibujarResumenAgregado(y, anchoPantalla);
    y += 30;
    y = this.dibujarUltimaTemporada(y, anchoPantalla);
    y += 30;
    this.dibujarBotonNuevaCarrera(y, anchoPantalla);

    const altoContenido = y + 70;
    const altoDisponible = altoPantalla - ALTO_HEADER;
    this.scrollMinY = Math.min(0, altoDisponible - altoContenido);
    this.scrollMaxY = 0;
    this.habilitarScroll();
  }

  // ---------------------------------------------------------------------
  // Contenido scrolleable para fin de temporada (no es la última de la
  // carrera): solo el resultado de esa temporada + botón para volver a la
  // plantilla y seguir jugando.
  // ---------------------------------------------------------------------
  mostrarResumenTemporada() {
    this.limpiarPantalla();
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    this.crearHeader(anchoPantalla);

    this.contenidoContainer = this.add.container(0, ALTO_HEADER);
    this.contenedorDinamico.add(this.contenidoContainer);

    let y = MARGEN_SUPERIOR;

    const titulo = this.add
      .text(anchoPantalla / 2, y, `Temporada ${this.seasonNumber} completada`, {
        fontFamily: 'Arial',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#d4af37',
      })
      .setOrigin(0.5, 0);
    this.contenidoContainer.add(titulo);
    y += 30;

    y = this.dibujarUltimaTemporada(y, anchoPantalla);
    y += 30;
    this.dibujarBotonContinuarPlantilla(y, anchoPantalla);

    const altoContenido = y + 70;
    const altoDisponible = altoPantalla - ALTO_HEADER;
    this.scrollMinY = Math.min(0, altoDisponible - altoContenido);
    this.scrollMaxY = 0;
    this.habilitarScroll();
  }

  dibujarBotonContinuarPlantilla(y, anchoPantalla) {
    const boton = this.add
      .text(anchoPantalla / 2, y, 'Continuar a mi plantilla', {
        fontFamily: 'Arial',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#1a1a2e',
        backgroundColor: '#d4af37',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });

    boton.on('pointerdown', () => this.continuarAPlantilla(boton));
    this.contenidoContainer.add(boton);
  }

  async continuarAPlantilla(boton) {
    boton.disableInteractive();
    boton.setText('Cargando...');

    try {
      const cards = await getManagerCards(this.managerId);
      this.scene.start('CollectionScene', { managerId: this.managerId, cards });
    } catch (error) {
      this.mostrarError(error);
    }
  }

  // Dibuja la fila de una temporada y devuelve el Y donde debería arrancar
  // la fila siguiente (para no tener que recalcular alturas dos veces).
  dibujarFilaTemporada(temporada, y, anchoPantalla) {
    const nombresTrofeos = this.nombresDeTrofeos(temporada.trophies);
    const textoTrofeos = nombresTrofeos ? `🏆 ${nombresTrofeos.join(', ')}` : 'Sin trofeos';

    const posicion = temporada.completed ? `${temporada.league_position}°` : 'en curso';
    const puntos = temporada.completed ? `${temporada.points} pts` : '—';

    const fondo = this.add
      .rectangle(anchoPantalla / 2, y + ALTO_FILA_TEMPORADA / 2, anchoPantalla - 40, ALTO_FILA_TEMPORADA - 6, 0x0f1626)
      .setStrokeStyle(1, 0x2a3550);
    this.contenidoContainer.add(fondo);

    const etiquetaTemporada = this.add
      .text(32, y + 8, `T${temporada.season_number}`, {
        fontFamily: 'Arial',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#d4af37',
      })
      .setOrigin(0, 0);

    const etiquetaStats = this.add
      .text(90, y + 8, `Posición ${posicion} · ${puntos}`, {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#ffffff',
      })
      .setOrigin(0, 0);

    const etiquetaTrofeos = this.add
      .text(anchoPantalla - 32, y + 8, textoTrofeos, {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: nombresTrofeos ? '#d4af37' : '#5a6478',
        align: 'right',
        wordWrap: { width: anchoPantalla - 320 },
      })
      .setOrigin(1, 0);

    this.contenidoContainer.add([etiquetaTemporada, etiquetaStats, etiquetaTrofeos]);
    return y + ALTO_FILA_TEMPORADA;
  }

  // Resumen agregado: total de títulos, mejor posición histórica y
  // promedio de puntos, considerando solo temporadas ya completadas (una
  // temporada "en curso" todavía no tiene points/league_position finales).
  dibujarResumenAgregado(y, anchoPantalla) {
    const completadas = this.temporadas.filter((t) => t.completed);

    const totalTitulos = completadas.reduce(
      (acumulado, t) => acumulado + Object.keys(t.trophies ?? {}).length,
      0
    );
    const posiciones = completadas.map((t) => t.league_position).filter((p) => p != null);
    const mejorPosicion = posiciones.length ? Math.min(...posiciones) : null;
    const promedioPuntos = completadas.length
      ? Math.round(completadas.reduce((acumulado, t) => acumulado + (t.points ?? 0), 0) / completadas.length)
      : null;

    const marco = this.add
      .rectangle(anchoPantalla / 2, y + 55, anchoPantalla - 40, 100, 0x0f1626, 0.97)
      .setStrokeStyle(2, 0xd4af37);
    this.contenidoContainer.add(marco);

    const titulo = this.add
      .text(anchoPantalla / 2, y + 14, 'RESUMEN DE CARRERA', {
        fontFamily: 'Arial',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#d4af37',
      })
      .setOrigin(0.5, 0);

    const lineas = [
      `Títulos ganados: ${totalTitulos}`,
      `Mejor posición histórica: ${mejorPosicion != null ? mejorPosicion + '°' : '—'}`,
      `Promedio de puntos: ${promedioPuntos != null ? promedioPuntos : '—'}`,
    ];
    const textoLineas = this.add
      .text(anchoPantalla / 2, y + 42, lineas.join('\n'), {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5, 0);

    this.contenidoContainer.add([titulo, textoLineas]);
    return y + 110;
  }

  // Muestra en texto simple (sin pulido visual todavía) los datos de la
  // temporada recién completada que manda SeasonScene: posición final,
  // tabla completa y momentos destacados. Si la escena se abrió sin estos
  // datos (flujo viejo de testing), cada uno cae a un placeholder "—" en
  // vez de romper.
  dibujarUltimaTemporada(y, anchoPantalla) {
    const titulo = this.add
      .text(24, y, 'ÚLTIMA TEMPORADA', {
        fontFamily: 'Arial',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#9aa5b8',
      })
      .setOrigin(0, 0);
    this.contenidoContainer.add(titulo);
    y += 24;

    const textoPosicion = this.leaguePosition != null ? `Posición final: ${this.leaguePosition}°` : 'Posición final: —';
    const lineaPosicion = this.add
      .text(24, y, textoPosicion, {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#ffffff',
      })
      .setOrigin(0, 0);
    this.contenidoContainer.add(lineaPosicion);
    y += 22;

    const lineasTabla =
      Array.isArray(this.tablaCompleta) && this.tablaCompleta.length > 0
        ? this.tablaCompleta.map(
            (fila, indice) =>
              `${indice + 1}. ${fila.equipo} — PJ ${fila.pj} PG ${fila.pg} PE ${fila.pe} PP ${fila.pp} GF ${fila.gf} GC ${fila.gc} DG ${fila.dg} Pts ${fila.puntos}`
          )
        : ['—'];
    const textoTabla = this.add
      .text(24, y, ['Tabla final:', ...lineasTabla].join('\n'), {
        fontFamily: 'Arial',
        fontSize: '11px',
        color: '#cccccc',
        lineSpacing: 4,
      })
      .setOrigin(0, 0);
    this.contenidoContainer.add(textoTabla);
    y += textoTabla.height + 10;

    const lineasMomentos =
      Array.isArray(this.momentosDestacados) && this.momentosDestacados.length > 0
        ? this.momentosDestacados.map((momento) => `• ${momento.descripcion}`)
        : ['—'];
    const textoMomentos = this.add
      .text(24, y, ['Momentos destacados:', ...lineasMomentos].join('\n'), {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#ffffff',
        wordWrap: { width: anchoPantalla - 48 },
        lineSpacing: 6,
      })
      .setOrigin(0, 0);
    this.contenidoContainer.add(textoMomentos);
    y += textoMomentos.height + 10;

    return y;
  }

  dibujarBotonNuevaCarrera(y, anchoPantalla) {
    const boton = this.add
      .text(anchoPantalla / 2, y, 'Nueva carrera', {
        fontFamily: 'Arial',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#e74c3c',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });

    boton.on('pointerdown', () => this.confirmarNuevaCarrera(boton));
    this.contenidoContainer.add(boton);
  }

  // Nueva carrera = borrar el manager entero. Mismo criterio que
  // resetearCuenta() del panel de dev (delete en `managers`, todo lo demás
  // cascadea por FK), pero acá es el flujo real: confirmamos antes con
  // window.confirm y, si el jugador confirma, recargamos la página para
  // que main.js vuelva a arrancar desde cero (sin manager, te manda al
  // formulario de crear DT).
  async confirmarNuevaCarrera(boton) {
    const confirmado = window.confirm(
      '¿Empezar una carrera nueva? Esto borra tu DT actual, tus cartas, tu 11 y todas tus temporadas. No se puede deshacer.'
    );
    if (!confirmado) return;

    boton.disableInteractive();
    boton.setText('Borrando...');

    try {
      await borrarManager(this.managerId);
      location.reload();
    } catch (error) {
      this.mostrarError(error);
    }
  }

  habilitarScroll() {
    this.input.on('wheel', (_pointer, _gameObjects, _deltaX, deltaY) => {
      const nuevaOffset = this.contenidoContainer.y - ALTO_HEADER - deltaY;
      const offsetClamp = Phaser.Math.Clamp(nuevaOffset, this.scrollMinY, this.scrollMaxY);
      this.contenidoContainer.y = ALTO_HEADER + offsetClamp;
    });
  }
}
