// leagueTable.js — arma la tabla de posiciones FINAL de una temporada
// completa de 20 equipos (tu equipo + los 19 rivales de rivalesFuerza).
//
// Lógica pura (nada de Phaser, nada de Supabase): a diferencia de
// calcularPosicionFinal en seasonSimulator.js (que solo ESTIMA tu posición
// comparando puntos esperados, sin jugar los cruces entre rivales), acá se
// juega efectivamente el campeonato completo: se arma un fixture ida/vuelta
// de 20 equipos y se resuelven TODOS los partidos, incluidos los que no te
// involucran a vos, para poder construir una tabla real con las 20 filas.
//
// -----------------------------------------------------------------------
// EL FIXTURE: EL VIEJO TRUCO DEL EQUIPO FANTASMA
// -----------------------------------------------------------------------
//
// seasonSimulator.js ya decide, fecha a fecha, contra qué rival jugás vos
// (ver el comentario "INDEXADO DE rivalesFuerza" en ese archivo): en la
// jornada N jugás contra rivalesFuerza[(N - 1) % 19], de local en la
// primera rueda (fechas 1-19) y de visitante en la revancha (20-38). Ese
// resultado YA está resuelto en resultadosJugador y acá no se retoca.
//
// Lo que falta es el fixture de los 19 rivales ENTRE ELLOS. Para que sea
// consistente con lo anterior (que cada rival, en la fecha que te toca a
// vos, no esté también jugando otro partido) usamos el método del círculo
// estándar de round-robin con 20 equipos, donde el "equipo 0" sos vos: por
// construcción, en cada una de las 19 rondas de la primera rueda el equipo
// 0 juega contra exactamente un rival y los otros 18 se emparejan entre sí
// en los 9 partidos restantes. Es exactamente el mismo truco que se usa
// para armar el fixture de una liga con cantidad IMPAR de equipos (acá, 19
// rivales) dándole un "bye" rotativo a uno por ronda: ese que tiene el bye
// sos vos.
import { simularJornada } from './seasonSimulator.js';

// generarRondasRoundRobin arma, con el método del círculo, el fixture de una
// sola rueda (ida) para `totalEquipos` equipos (par). Fija el equipo 0 (vos)
// y rota el resto. Devuelve un array de `totalEquipos - 1` rondas, cada una
// con `totalEquipos / 2` pares [equipoLocal, equipoVisitante] (los índices
// son posiciones 0-based: 0 sos vos, 1..N son los rivales en un orden
// arbitrario que todavía no corresponde al índice de rivalesFuerza).
function generarRondasRoundRobin(totalEquipos) {
  let rotando = [];
  for (let i = 1; i < totalEquipos; i++) rotando.push(i);

  const rondas = [];

  for (let ronda = 0; ronda < totalEquipos - 1; ronda++) {
    const actual = [0, ...rotando];
    const pares = [];
    for (let i = 0; i < totalEquipos / 2; i++) {
      pares.push([actual[i], actual[totalEquipos - 1 - i]]);
    }
    rondas.push(pares);

    // Rotación: el fijo (posición 0) queda quieto, el resto gira.
    rotando = [rotando[rotando.length - 1], ...rotando.slice(0, rotando.length - 1)];
  }

  return rondas;
}

// mapearSlotsARivales recorre las rondas de la primera rueda y, para cada
// una, ve contra qué "slot" (posición arbitraria 1..19 del round-robin)
// jugás vos esa ronda. Como en la ronda R (0-based) tu partido real es
// resultadosJugador[R] (que ya sabemos que enfrenta a rivalesFuerza[R], ver
// el comentario grande de arriba), ese slot pasa a representar exactamente
// al rival de índice R. Devuelve un Map slot -> índice en rivalesFuerza.
function mapearSlotsARivales(rondas) {
  const slotARivalIndice = new Map();

  rondas.forEach((pares, indiceRonda) => {
    const parConVos = pares.find(([local, visitante]) => local === 0 || visitante === 0);
    const slotRival = parConVos[0] === 0 ? parConVos[1] : parConVos[0];
    slotARivalIndice.set(slotRival, indiceRonda);
  });

  return slotARivalIndice;
}

// crearFilaVacia arranca los acumuladores de una fila de tabla en cero.
function crearFilaVacia(equipo) {
  return {
    equipo,
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

// sumarResultado actualiza en el lugar una fila con el resultado de un
// partido desde SU punto de vista (golesA favor, golesEnContra).
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

// calcularTablaFinal juega el campeonato completo de 20 equipos (vos + los
// 19 de rivalesFuerza) y devuelve la tabla de posiciones final.
//
// Parámetros:
//   - rivalesFuerza: array de 19 números (mismo formato y mismo orden que
//     usa seasonSimulator.js/seasonOrchestrator.js).
//   - resultadosJugador: array de 38 resultados reales de tu equipo, mismo
//     shape que devuelve simularTramo en estado.resultados
//     ({ jornada, esLocal, rivalFuerza, golesPlantel, golesRival,
//     resultado }). NO se resimulan: se usan tal cual vinieron.
//
// Los partidos entre los otros 19 rivales (los que no te involucran) se
// resuelven con simularJornada, ya exportada por seasonSimulator.js, sin
// generar relato ni eventos: solo el marcador.
//
// Devuelve { tabla, posicionJugador }:
//   - tabla: las 20 filas, ordenadas por puntos y luego diferencia de gol.
//   - posicionJugador: en qué puesto (1-20) quedó tu equipo en esa tabla.
export function calcularTablaFinal({ rivalesFuerza, resultadosJugador }) {
  const totalEquipos = rivalesFuerza.length + 1;

  const rondasIda = generarRondasRoundRobin(totalEquipos);
  const slotARivalIndice = mapearSlotsARivales(rondasIda);

  const filaJugador = crearFilaVacia('TU_EQUIPO');
  const filasRivales = rivalesFuerza.map((fuerza, indice) =>
    crearFilaVacia(`RIVAL_${indice + 1}`)
  );

  // 1. Tus 38 partidos: se toman tal cual de resultadosJugador (no se
  //    resimulan) y se reflejan también en la fila del rival que te tocó.
  for (const resultado of resultadosJugador) {
    sumarResultado(filaJugador, resultado.golesPlantel, resultado.golesRival);

    const indiceRival = (resultado.jornada - 1) % rivalesFuerza.length;
    sumarResultado(filasRivales[indiceRival], resultado.golesRival, resultado.golesPlantel);
  }

  // 2. Los partidos entre los otros 19 rivales: una rueda (ida) sale directo
  //    de rondasIda, la otra (vuelta) es la misma pero de local/visitante
  //    invertidos. En ambas se saltea el par que te incluye a vos (ya
  //    resuelto en el paso 1).
  for (const pares of rondasIda) {
    for (const [slotLocal, slotVisitante] of pares) {
      if (slotLocal === 0 || slotVisitante === 0) continue;

      const indiceLocal = slotARivalIndice.get(slotLocal);
      const indiceVisitante = slotARivalIndice.get(slotVisitante);

      // Ida: slotLocal de local.
      const ida = simularJornada(rivalesFuerza[indiceLocal], rivalesFuerza[indiceVisitante]);
      sumarResultado(filasRivales[indiceLocal], ida.golesLocal, ida.golesVisitante);
      sumarResultado(filasRivales[indiceVisitante], ida.golesVisitante, ida.golesLocal);

      // Vuelta: mismo par, local y visitante invertidos.
      const vuelta = simularJornada(rivalesFuerza[indiceVisitante], rivalesFuerza[indiceLocal]);
      sumarResultado(filasRivales[indiceVisitante], vuelta.golesLocal, vuelta.golesVisitante);
      sumarResultado(filasRivales[indiceLocal], vuelta.golesVisitante, vuelta.golesLocal);
    }
  }

  const tabla = [filaJugador, ...filasRivales].sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    return b.dg - a.dg;
  });

  const posicionJugador = tabla.indexOf(filaJugador) + 1;

  return { tabla, posicionJugador };
}
