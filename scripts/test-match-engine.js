// test-match-engine.js — script rápido para probar matchEngine.js desde la terminal.
//
// Corré con: node scripts/test-match-engine.js
//
// Nota: src/data/mockCards.js tiene jugadores de prueba, pero solo con
// overall_rating (no tiene pace, shooting, passing, defense, physical ni
// goalkeeping por separado, que es lo que necesita el motor de partido).
// Por eso acá armamos dos plantillas de 11 jugadores con stats fijas a mano,
// pensadas para que el equipo local (home) sea claramente mejor que el
// visitante (away), y así ver goles de los dos lados en la simulación.

import { simulateMatch } from '../src/engine/matchEngine.js';

// crearJugador es un pequeño helper para no repetir las 6 stats cada vez.
function crearJugador(name, position, stats) {
  return {
    name,
    position, // 'POR' (arquero), 'DEF', 'MED' o 'DEL'
    pace: stats.pace,
    shooting: stats.shooting,
    passing: stats.passing,
    defense: stats.defense,
    physical: stats.physical,
    goalkeeping: stats.goalkeeping,
  };
}

// Equipo local: "Dream FC", con stats altas.
const dreamFC = {
  name: 'Dream FC',
  players: [
    crearJugador('Arquero Titular', 'POR', { pace: 50, shooting: 30, passing: 55, defense: 60, physical: 65, goalkeeping: 85 }),
    crearJugador('Defensor 1', 'DEF', { pace: 70, shooting: 40, passing: 65, defense: 82, physical: 80, goalkeeping: 0 }),
    crearJugador('Defensor 2', 'DEF', { pace: 68, shooting: 35, passing: 63, defense: 80, physical: 78, goalkeeping: 0 }),
    crearJugador('Defensor 3', 'DEF', { pace: 72, shooting: 38, passing: 66, defense: 79, physical: 76, goalkeeping: 0 }),
    crearJugador('Defensor 4', 'DEF', { pace: 69, shooting: 36, passing: 64, defense: 81, physical: 77, goalkeeping: 0 }),
    crearJugador('Mediocampista 1', 'MED', { pace: 78, shooting: 70, passing: 85, defense: 60, physical: 70, goalkeeping: 0 }),
    crearJugador('Mediocampista 2', 'MED', { pace: 76, shooting: 68, passing: 83, defense: 58, physical: 68, goalkeeping: 0 }),
    crearJugador('Mediocampista 3', 'MED', { pace: 80, shooting: 72, passing: 86, defense: 55, physical: 72, goalkeeping: 0 }),
    crearJugador('Delantero 1', 'DEL', { pace: 88, shooting: 89, passing: 78, defense: 30, physical: 75, goalkeeping: 0 }),
    crearJugador('Delantero 2', 'DEL', { pace: 85, shooting: 87, passing: 76, defense: 28, physical: 73, goalkeeping: 0 }),
    crearJugador('Delantero 3', 'DEL', { pace: 90, shooting: 91, passing: 80, defense: 32, physical: 74, goalkeeping: 0 }),
  ],
};

// Equipo visitante: "Rival United", con stats más bajas.
const rivalUnited = {
  name: 'Rival United',
  players: [
    crearJugador('Arquero Rival', 'POR', { pace: 40, shooting: 20, passing: 40, defense: 45, physical: 55, goalkeeping: 60 }),
    crearJugador('Defensor Rival 1', 'DEF', { pace: 55, shooting: 30, passing: 50, defense: 58, physical: 60, goalkeeping: 0 }),
    crearJugador('Defensor Rival 2', 'DEF', { pace: 53, shooting: 28, passing: 48, defense: 56, physical: 58, goalkeeping: 0 }),
    crearJugador('Defensor Rival 3', 'DEF', { pace: 54, shooting: 29, passing: 49, defense: 57, physical: 59, goalkeeping: 0 }),
    crearJugador('Defensor Rival 4', 'DEF', { pace: 52, shooting: 27, passing: 47, defense: 55, physical: 57, goalkeeping: 0 }),
    crearJugador('Mediocampista Rival 1', 'MED', { pace: 58, shooting: 50, passing: 60, defense: 40, physical: 55, goalkeeping: 0 }),
    crearJugador('Mediocampista Rival 2', 'MED', { pace: 56, shooting: 48, passing: 58, defense: 38, physical: 53, goalkeeping: 0 }),
    crearJugador('Mediocampista Rival 3', 'MED', { pace: 57, shooting: 49, passing: 59, defense: 39, physical: 54, goalkeeping: 0 }),
    crearJugador('Delantero Rival 1', 'DEL', { pace: 60, shooting: 58, passing: 55, defense: 20, physical: 50, goalkeeping: 0 }),
    crearJugador('Delantero Rival 2', 'DEL', { pace: 62, shooting: 60, passing: 56, defense: 22, physical: 52, goalkeeping: 0 }),
    crearJugador('Delantero Rival 3', 'DEL', { pace: 59, shooting: 57, passing: 54, defense: 21, physical: 51, goalkeeping: 0 }),
  ],
};

// onEvent de prueba: imprime cada evento en consola a medida que va pasando.
function onEventDeTest(evento) {
  console.log(`[min ${evento.minute}] ${evento.text}`);
}

// onDecision de prueba: imprime las opciones en consola y siempre elige la primera.
function onDecisionDeTest(decision) {
  console.log(`\n--- Punto de decisión: ${decision.situation} ---`);
  decision.options.forEach((opcion, indice) => {
    console.log(`  [${indice}] ${opcion.label} — ${opcion.description}`);
  });
  const elegida = decision.options[0];
  console.log(`Elegido automáticamente: "${elegida.label}"\n`);
  return elegida.id;
}

// simulateMatch ahora es async: hay que esperar su resultado con await,
// y para eso este script usa una función async "principal" que se ejecuta sola.
async function principal() {
  const resultado = await simulateMatch(dreamFC, rivalUnited, {
    onEvent: onEventDeTest,
    onDecision: onDecisionDeTest,
  });

  console.log('\n=== MARCADOR FINAL ===');
  console.log(`${dreamFC.name} ${resultado.marcadorFinal.home} - ${resultado.marcadorFinal.away} ${rivalUnited.name}`);

  console.log('\n=== DECISIONES TOMADAS ===');
  console.log(
    JSON.stringify(
      resultado.decisiones.map((d) => ({ minute: d.minute, situation: d.situation, marcador: d.marcador, elegida: d.elegida })),
      null,
      2
    )
  );
}

principal();
