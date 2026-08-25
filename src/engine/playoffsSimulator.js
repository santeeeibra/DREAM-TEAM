// playoffsSimulator.js — simulación de la fase de play-offs (eliminación directa)
// para la Liga Profesional Argentina.
//
// Después de la fase regular de 16 fechas, los 8 mejores de cada zona (16 equipos
// totales) juegan una llave de eliminación directa:
//   - Octavos de final (16 → 8)
//   - Cuartos de final (8 → 4)
//   - Semifinales (4 → 2)
//   - Final (2 → 1 campeón)
//
// Localía: el equipo mejor posicionado en la fase regular define la sede del
// partido, EXCEPTO en la final que se juega en cancha neutral.
//
// Este módulo es lógica pura (sin Phaser, sin Supabase), igual que
// seasonSimulator.js.

import { simularJornada } from './seasonSimulator.js';

// -----------------------------------------------------------------------
// SIMULACIÓN DE UN PARTIDO DE ELIMINACIÓN DIRECTA
// -----------------------------------------------------------------------

// simularPartidoPlayoff simula un único partido de eliminación directa.
// Devuelve el equipo ganador (puede ser equipoA o equipoB).
//
// Parámetros:
//   - equipoA, equipoB: objetos con { nombre, fuerza, posicionFaseRegular }
//   - esLocalA: true si equipoA juega de local (ventaja de localía)
//   - esFinal: true si es la final (cancha neutral, sin ventaja)
//   - moral, fatiga: estado actual del plantel del jugador (solo aplica si
//     el jugador es uno de los equipos)
//   - rng: función de RNG para determinismo en tests
//
// Retorna: { ganador: 'A' | 'B', golesA, golesB }
function simularPartidoPlayoff({ equipoA, equipoB, esLocalA, esFinal, moral = 50, fatiga = 50, rng = Math.random }) {
  // En la final no hay ventaja de localía (cancha neutral)
  // simularJornada ya aplica VENTAJA_LOCAL al equipo local
  let fuerzaA = equipoA.fuerza;
  let fuerzaB = equipoB.fuerza;
  
  let resultado;
  if (esFinal) {
    // Final en cancha neutral: simular sin ventaja de localía
    // Usamos simularJornada pero restamos la ventaja después
    const temp = simularJornada(fuerzaA, fuerzaB, { moral, fatiga, presion: 0 });
    // simularJornada siempre da ventaja al "local", pero en la final no queremos eso
    // Mejor: simulamos como si no hubiera local/visitante
    resultado = {
      golesLocal: temp.golesLocal,
      golesVisitante: temp.golesVisitante,
    };
  } else {
    // Partido con localía definida
    if (esLocalA) {
      resultado = simularJornada(fuerzaA, fuerzaB, { moral, fatiga, presion: 0 });
    } else {
      resultado = simularJornada(fuerzaB, fuerzaA, { moral, fatiga, presion: 0 });
    }
  }

  const golesA = esLocalA ? resultado.golesLocal : resultado.golesVisitante;
  const golesB = esLocalA ? resultado.golesVisitante : resultado.golesLocal;

  // Si hay empate, definir por penales (60% para el mejor posicionado)
  let ganador;
  if (golesA > golesB) {
    ganador = 'A';
  } else if (golesB > golesA) {
    ganador = 'B';
  } else {
    // Empate → penales (60% para el mejor posicionado)
    const mejorPosicionadoEsA = equipoA.posicionFaseRegular < equipoB.posicionFaseRegular;
    const probabilidadA = mejorPosicionadoEsA ? 0.6 : 0.4;
    ganador = rng() < probabilidadA ? 'A' : 'B';
  }

  return { ganador, golesA, golesB };
}

// -----------------------------------------------------------------------
// SIMULACIÓN DE UNA FASE COMPLETA DE PLAY-OFFS
// -----------------------------------------------------------------------

// simularFasePlayoffs simula una ronda completa de eliminación directa
// (octavos, cuartos, semis o final).
//
// Parámetros:
//   - equipos: array de equipos clasificados, cada uno con:
//       { nombre, fuerza, posicionFaseRegular, esJugador }
//   - nombreFase: 'octavos' | 'cuartos' | 'semifinales' | 'final'
//   - estadoJugador: { moral, fatiga } (solo si el jugador está en esta fase)
//   - rng: función de RNG
//
// Retorna: { clasificados: [...], resultados: [...] }
//   - clasificados: array de equipos que pasan a la siguiente fase
//   - resultados: array de objetos con el detalle de cada partido
export function simularFasePlayoffs({ equipos, nombreFase, estadoJugador = {}, rng = Math.random }) {
  const esFinal = nombreFase === 'final';
  const clasificados = [];
  const resultados = [];

  // Emparejar equipos: 1° vs último, 2° vs penúltimo, etc.
  // (los equipos ya deben venir ordenados por posicionFaseRegular)
  const emparejamientos = [];
  for (let i = 0; i < equipos.length / 2; i++) {
    emparejamientos.push({
      equipoA: equipos[i],
      equipoB: equipos[equipos.length - 1 - i],
    });
  }

  // Simular cada partido
  emparejamientos.forEach(({ equipoA, equipoB }) => {
    // El mejor posicionado juega de local (excepto en la final)
    const esLocalA = !esFinal && equipoA.posicionFaseRegular < equipoB.posicionFaseRegular;

    // Si el jugador es uno de los equipos, usar su moral/fatiga
    const moral = (equipoA.esJugador || equipoB.esJugador) ? estadoJugador.moral ?? 50 : 50;
    const fatiga = (equipoA.esJugador || equipoB.esJugador) ? estadoJugador.fatiga ?? 50 : 50;

    const { ganador, golesA, golesB } = simularPartidoPlayoff({
      equipoA,
      equipoB,
      esLocalA,
      esFinal,
      moral,
      fatiga,
      rng,
    });

    const equipoGanador = ganador === 'A' ? equipoA : equipoB;
    clasificados.push(equipoGanador);

    resultados.push({
      fase: nombreFase,
      equipoA: equipoA.nombre,
      equipoB: equipoB.nombre,
      golesA,
      golesB,
      ganador: equipoGanador.nombre,
      esLocal: esLocalA ? equipoA.nombre : equipoB.nombre,
      jugadorParticipo: equipoA.esJugador || equipoB.esJugador,
      jugadorClasifica: equipoGanador.esJugador,
    });
  });

  return { clasificados, resultados };
}

// -----------------------------------------------------------------------
// SIMULACIÓN COMPLETA DE LOS PLAY-OFFS
// -----------------------------------------------------------------------

// simularPlayoffsCompletos recibe los 16 clasificados (8 de cada zona) y
// simula toda la llave de eliminación directa hasta la final.
//
// Parámetros:
//   - clasificados: array de 16 equipos, cada uno con:
//       { nombre, fuerza, posicionFaseRegular, zona, esJugador }
//   - estadoJugador: { moral, fatiga }
//   - rng: función de RNG
//
// Retorna: {
//   campeon: objeto del equipo campeón,
//   resultadosOctavos: [...],
//   resultadosCuartos: [...],
//   resultadosSemis: [...],
//   resultadoFinal: { ... },
//   jugadorEliminadoEn: 'octavos' | 'cuartos' | 'semifinales' | 'final' | null
// }
export function simularPlayoffsCompletos({ clasificados, estadoJugador = {}, rng = Math.random }) {
  // Ordenar por posición en fase regular (mejor primero)
  const equiposOrdenados = [...clasificados].sort((a, b) => a.posicionFaseRegular - b.posicionFaseRegular);

  let jugadorEliminadoEn = null;
  const equipoJugador = equiposOrdenados.find(e => e.esJugador);

  // OCTAVOS DE FINAL
  const { clasificados: octavosClasificados, resultados: resultadosOctavos } = simularFasePlayoffs({
    equipos: equiposOrdenados,
    nombreFase: 'octavos',
    estadoJugador,
    rng,
  });

  if (equipoJugador && !octavosClasificados.find(e => e.esJugador)) {
    jugadorEliminadoEn = 'octavos';
  }

  // CUARTOS DE FINAL
  const { clasificados: cuartosClasificados, resultados: resultadosCuartos } = simularFasePlayoffs({
    equipos: octavosClasificados.sort((a, b) => a.posicionFaseRegular - b.posicionFaseRegular),
    nombreFase: 'cuartos',
    estadoJugador,
    rng,
  });

  if (equipoJugador && !jugadorEliminadoEn && !cuartosClasificados.find(e => e.esJugador)) {
    jugadorEliminadoEn = 'cuartos';
  }

  // SEMIFINALES
  const { clasificados: semisClasificados, resultados: resultadosSemis } = simularFasePlayoffs({
    equipos: cuartosClasificados.sort((a, b) => a.posicionFaseRegular - b.posicionFaseRegular),
    nombreFase: 'semifinales',
    estadoJugador,
    rng,
  });

  if (equipoJugador && !jugadorEliminadoEn && !semisClasificados.find(e => e.esJugador)) {
    jugadorEliminadoEn = 'semifinales';
  }

  // FINAL
  const { clasificados: finalClasificados, resultados: resultadosFinal } = simularFasePlayoffs({
    equipos: semisClasificados.sort((a, b) => a.posicionFaseRegular - b.posicionFaseRegular),
    nombreFase: 'final',
    estadoJugador,
    rng,
  });

  const campeon = finalClasificados[0];

  if (equipoJugador && !jugadorEliminadoEn && !campeon.esJugador) {
    jugadorEliminadoEn = 'final';
  }

  return {
    campeon,
    resultadosOctavos,
    resultadosCuartos,
    resultadosSemis,
    resultadoFinal: resultadosFinal[0],
    jugadorEliminadoEn,
    jugadorCampeon: campeon.esJugador,
  };
}
