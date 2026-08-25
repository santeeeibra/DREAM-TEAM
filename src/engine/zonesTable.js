// zonesTable.js — cálculo de la tabla de posiciones POR ZONAS para la
// Liga Profesional Argentina.
//
// A diferencia de leagueTable.js (que calcula una tabla unificada de 20 equipos),
// este módulo divide los 30 equipos en Zona A y Zona B (15 equipos cada una) y
// calcula la tabla de cada zona por separado.
//
// Los 8 mejores de cada zona clasifican a los play-offs.
//
// Lógica pura (sin Phaser, sin Supabase).

import { simularJornada } from './seasonSimulator.js';
import { LIGAPRO_EQUIPOS_POR_ZONA, LIGAPRO_CLASIFICADOS_POR_ZONA } from '../core/constants.js';

// -----------------------------------------------------------------------
// HELPERS DE TABLA
// -----------------------------------------------------------------------

function crearFilaVacia(equipo, zona) {
  return {
    equipo,
    zona,
    pj: 0,
    pg: 0,
    pe: 0,
    pp: 0,
    gf: 0,
    gc: 0,
    dg: 0,
    puntos: 0,
  };
}

function sumarResultado(fila, golesAFavor, golesEnContra) {
  fila.pj++;
  fila.gf += golesAFavor;
  fila.gc += golesEnContra;
  fila.dg = fila.gf - fila.gc;

  if (golesAFavor > golesEnContra) {
    fila.pg++;
    fila.puntos += 3;
  } else if (golesAFavor === golesEnContra) {
    fila.pe++;
    fila.puntos += 1;
  } else {
    fila.pp++;
  }
}

// -----------------------------------------------------------------------
// ASIGNACIÓN DE ZONAS
// -----------------------------------------------------------------------

// asignarZonas divide los 30 equipos en Zona A (primeros 15) y Zona B (últimos 15).
// En la realidad se define por sorteo/región, pero para simplicidad del juego
// usamos división directa.
//
// Parámetros:
//   - equipos: array de 30 objetos con { nombre, fuerza }
//
// Retorna: { zonaA: [...], zonaB: [...] }
export function asignarZonas(equipos) {
  if (equipos.length !== 30) {
    throw new Error(`asignarZonas requiere exactamente 30 equipos, recibió ${equipos.length}`);
  }

  return {
    zonaA: equipos.slice(0, LIGAPRO_EQUIPOS_POR_ZONA).map((e, i) => ({ ...e, zona: 'A', indiceZona: i })),
    zonaB: equipos.slice(LIGAPRO_EQUIPOS_POR_ZONA).map((e, i) => ({ ...e, zona: 'B', indiceZona: i })),
  };
}

// -----------------------------------------------------------------------
// CÁLCULO DE TABLA POR ZONA
// -----------------------------------------------------------------------

// calcularTablaPorZona simula todos los partidos de la fase regular de UNA zona
// (cada equipo juega contra los otros 14 de su zona) y devuelve la tabla ordenada.
//
// Parámetros:
//   - equiposZona: array de 15 equipos de una zona, cada uno con { nombre, fuerza, esJugador }
//   - nombreZona: 'A' | 'B'
//   - estadoJugador: { moral, fatiga, ratingPlantel } (solo si el jugador está en esta zona)
//   - rng: función de RNG
//
// Retorna: array de filas ordenadas por puntos (mejor primero)
export function calcularTablaPorZona({ equiposZona, nombreZona, estadoJugador = {}, rng = Math.random }) {
  if (equiposZona.length !== LIGAPRO_EQUIPOS_POR_ZONA) {
    throw new Error(`calcularTablaPorZona requiere ${LIGAPRO_EQUIPOS_POR_ZONA} equipos, recibió ${equiposZona.length}`);
  }

  const tabla = {};
  equiposZona.forEach(e => {
    tabla[e.nombre] = crearFilaVacia(e.nombre, nombreZona);
  });

  // Generar fixture round-robin (cada equipo juega contra los otros 14)
  const totalEquipos = equiposZona.length;
  const fechas = [];

  for (let fecha = 0; fecha < totalEquipos - 1; fecha++) {
    const partidosFecha = [];
    for (let i = 0; i < totalEquipos / 2; i++) {
      const indiceLocal = (fecha + i) % totalEquipos;
      const indiceVisitante = (totalEquipos - 1 - i + fecha) % totalEquipos;
      
      if (indiceLocal !== indiceVisitante) {
        partidosFecha.push({
          local: equiposZona[indiceLocal],
          visitante: equiposZona[indiceVisitante],
        });
      }
    }
    fechas.push(partidosFecha);
  }

  // Simular todos los partidos
  fechas.forEach(partidosFecha => {
    partidosFecha.forEach(({ local, visitante }) => {
      const esPartidoJugador = local.esJugador || visitante.esJugador;
      const moral = esPartidoJugador ? estadoJugador.moral ?? 50 : 50;
      const fatiga = esPartidoJugador ? estadoJugador.fatiga ?? 50 : 50;
      const presion = esPartidoJugador ? estadoJugador.presion ?? 0 : 0;

      const resultado = simularJornada({
        fuerzaPlantel: local.fuerza,
        fuerzaRival: visitante.fuerza,
        esLocal: true,
        moral,
        fatiga,
        presion,
        rng,
      });

      sumarResultado(tabla[local.nombre], resultado.golesPlantel, resultado.golesRival);
      sumarResultado(tabla[visitante.nombre], resultado.golesRival, resultado.golesPlantel);
    });
  });

  // Ordenar tabla: puntos (desc) → dg (desc) → gf (desc)
  const tablaOrdenada = Object.values(tabla).sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    if (b.dg !== a.dg) return b.dg - a.dg;
    return b.gf - a.gf;
  });

  tablaOrdenada.forEach((fila, i) => {
    fila.posicion = i + 1;
  });

  return tablaOrdenada;
}

// -----------------------------------------------------------------------
// OBTENER CLASIFICADOS A PLAY-OFFS
// -----------------------------------------------------------------------

// obtenerClasificados devuelve los 8 mejores de cada zona (16 equipos totales).
export function obtenerClasificados({ tablaZonaA, tablaZonaB }) {
  const clasificadosA = tablaZonaA.slice(0, LIGAPRO_CLASIFICADOS_POR_ZONA).map(fila => ({
    nombre: fila.equipo,
    zona: 'A',
    posicionFaseRegular: fila.posicion,
    puntos: fila.puntos,
  }));

  const clasificadosB = tablaZonaB.slice(0, LIGAPRO_CLASIFICADOS_POR_ZONA).map(fila => ({
    nombre: fila.equipo,
    zona: 'B',
    posicionFaseRegular: fila.posicion,
    puntos: fila.puntos,
  }));

  return [...clasificadosA, ...clasificadosB];
}
