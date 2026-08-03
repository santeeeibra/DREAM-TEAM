// scripts/simulate-career.js — harness headless para correr carreras completas
// (8 temporadas) contra la lógica pura de src/engine y src/state/careerState.js,
// sin Phaser y sin tocar Supabase de verdad. Sirve para balancear el juego con
// datos y para detectar regresiones cuando se toque la lógica de carrera.
//
// Uso:
//   node scripts/simulate-career.js
//   node scripts/simulate-career.js --carreras=50 --seed=7 --politica=primera --verbose
//
// -----------------------------------------------------------------------
// DECISIONES DE DISEÑO Y HALLAZGOS (leer antes de tocar este archivo)
// -----------------------------------------------------------------------
//
// 1) careerState.js importa src/data/supabaseClient.js, que llama a
//    createClient() con import.meta.env.VITE_SUPABASE_URL — una variable que
//    solo existe bajo Vite, no en Node puro. Importar careerState.js con un
//    `node` normal explota apenas se evalúa ese import (import.meta.env es
//    undefined en Node, y createClient(undefined, undefined) tira igual).
//    Como la consigna prohíbe tocar careerState.js o supabaseClient.js,
//    la solución es un hook de resolución de módulos (node:module#register,
//    API estable desde Node 20.6) que intercepta el specifier
//    '.../supabaseClient.js' ANTES de que se cargue y lo reemplaza por un
//    módulo stub en memoria (data: URL) que exporta `supabase = {}`. Nunca
//    se usa ese objeto: la única función que lo toca es careerState.persist(),
//    que este harness nunca llama. El hook se registra antes de importar
//    (con `import()` dinámico) cualquier módulo del engine, porque los
//    `import` estáticos de un archivo se resuelven ANTES de ejecutar su
//    cuerpo (o sea, antes de que un `register()` puesto en el cuerpo llegue
//    a correr).
//
// 2) Discrepancia con la consigna original: el traductor de efectos de
//    seasonOrchestrator.js (traducirEffects) espera las claves en inglés
//    `morale` y `fatigue` (no `moral`/`fatiga` como decía el pedido). Se
//    usan las claves reales en scripts/fixtures/eventos-mock.json.
//
// 3) Posible bug real (no corregido, solo reportado): aplicarDecisionYContinuar
//    llama a careerState.applyEffects(...) ANTES de sincronizar careerState
//    con el `moral`/`fatiga` que trae `estado` (que sí evolucionó fecha a
//    fecha dentro del tramo recién jugado, vía seasonSimulator). Como
//    careerState nunca se entera de esa evolución intra-tramo, cada evento
//    aplica su delta sobre un valor de moral/fatiga desactualizado y ese
//    resultado (no el de seasonSimulator) es el que se copia de vuelta a
//    `estado`. En la práctica, cada evento puede "resetear" silenciosamente
//    el efecto de los resultados deportivos del tramo sobre moral/fatiga.
//
// 4) Otro hallazgo: careerState.syncStreakFromResultados existe y está
//    documentada, pero no la llama nadie en el código de producción (ni
//    seasonOrchestrator.js ni SeasonScene.js). Eso significa que `streak`
//    quirks el valor con el que se inicializó careerState y el bonus de
//    momentum de getEffectiveRating no refleja los resultados reales de la
//    temporada. Este harness tampoco la llama (para no simular un
//    comportamiento que el juego real no tiene).
//
// 5) careerState.initCareerState() se llama UNA sola vez por CARRERA (no una
//    vez por temporada como hace SeasonScene.js en el juego real, que arranca
//    cada temporada desde una fila `seasons` nueva con pressure/streak en sus
//    defaults de columna). Se eligió así porque la consigna describe la
//    inicialización como parte de "simular UNA carrera", y permite que
//    money/pressure/streak evolucionen de forma continua a lo largo de las 8
//    temporadas, que es justo lo que querés poder observar en un reporte de
//    balance de carrera completa. `fatiga` se resetea a mano a 0 en el
//    `estado` de cada temporada nueva porque así lo pide la consigna (punto
//    3); el fatigue cacheado dentro de careerState NO se resetea (no hay
//    forma de hacerlo sin pasar por applyEffects), así que puede quedar
//    desactualizado hasta el próximo evento — ver el hallazgo (3).
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

// -----------------------------------------------------------------------
// 0. RNG con semilla (mulberry32, sin dependencias)
// -----------------------------------------------------------------------
// Reemplazamos Math.random ANTES de importar nada del engine: todo lo que
// usa azar (goles, sorteo de eventos, generación de rivales, política
// "random") pasa por Math.random(), así que pisándolo acá alcanza para que
// TODA la carrera (motor + este mismo harness) sea reproducible con la
// misma semilla.
function crearMulberry32(semilla) {
  let a = semilla >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// -----------------------------------------------------------------------
// 1. CLI flags, parseados a mano (sin librerías)
// -----------------------------------------------------------------------
function parsearArgs(argv) {
  const args = { carreras: 1, seed: 42, politica: 'random', verbose: false };
  for (const arg of argv) {
    if (arg === '--verbose') {
      args.verbose = true;
      continue;
    }
    const separador = arg.indexOf('=');
    if (separador === -1) continue;
    const clave = arg.slice(0, separador);
    const valor = arg.slice(separador + 1);
    if (clave === '--carreras') args.carreras = parseInt(valor, 10);
    else if (clave === '--seed') args.seed = parseInt(valor, 10);
    else if (clave === '--politica') args.politica = valor;
  }
  return args;
}

const args = parsearArgs(process.argv.slice(2));
globalThis.Math.random = crearMulberry32(args.seed);

// -----------------------------------------------------------------------
// 2. Hook de resolución de módulos: stub de supabaseClient.js (ver hallazgo 1)
// -----------------------------------------------------------------------
const HOOK_CODE = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('data/supabaseClient.js')) {
    return {
      url: 'data:text/javascript,export const supabase = {};',
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
`;
register('data:text/javascript,' + encodeURIComponent(HOOK_CODE), import.meta.url);

// Import dinámico y DESPUÉS de register(): un `import` estático de estos
// módulos se resolvería antes de que el hook llegue a registrarse.
const { simularHastaProximoEvento, aplicarDecisionYContinuar } = await import(
  '../src/engine/seasonOrchestrator.js'
);
const { calcularTablaFinal } = await import('../src/engine/leagueTable.js');
const { FATIGA_INICIAL_POR_DEFECTO, MORAL_INICIAL_POR_DEFECTO } = await import(
  '../src/engine/seasonSimulator.js'
);
const careerState = await import('../src/state/careerState.js');

// -----------------------------------------------------------------------
// 3. Constantes tuneables del harness
// -----------------------------------------------------------------------
const RATING_BASE_INICIAL = 78; // rating de papel del plantel al arrancar la carrera
const MEJORA_POR_REFUERZO = 1; // cuánto sube ratingBase entre temporadas (sobre de refuerzo)
const TOTAL_TEMPORADAS = 8;
const DINERO_INICIAL = 1_000_000; // no hay un default documentado para managers.money; valor de referencia del harness
const PRESION_INICIAL = 50; // mismo default "neutral" que la columna seasons.pressure
const STREAK_INICIAL = 0; // mismo default que la columna seasons.streak

// Clamps de careerState.js: no están exportados, así que los repetimos acá
// SOLO para poder chequear en las alertas si un valor tocó el borde.
const RATING_DELTA_CLAMP = 8;
const MORAL_FATIGA_MIN = 0;
const MORAL_FATIGA_MAX = 100;

// Mismos parámetros de generación de rivales que usa SeasonScene.js
// (generarRivalesFuerza), reescritos acá sin Phaser.Math.Clamp porque este
// harness no puede importar Phaser.
const CANTIDAD_RIVALES = 19;
const RIVALES_SPREAD = 14;
const RIVALES_MIN = 40;
const RIVALES_MAX = 99;

function clamp(valor, minimo, maximo) {
  return Math.max(minimo, Math.min(maximo, valor));
}

function generarRivalesFuerza(ratingBase) {
  const rivales = [];
  for (let i = 0; i < CANTIDAD_RIVALES; i++) {
    const ruido = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    rivales.push(Math.round(clamp(ratingBase + ruido * RIVALES_SPREAD, RIVALES_MIN, RIVALES_MAX)));
  }
  return rivales;
}

// -----------------------------------------------------------------------
// 4. Fixture de eventos
// -----------------------------------------------------------------------
const eventosDisponibles = JSON.parse(
  readFileSync(new URL('./fixtures/eventos-mock.json', import.meta.url), 'utf-8')
);

// -----------------------------------------------------------------------
// 5. Política de decisiones
// -----------------------------------------------------------------------
function elegirOpcion(opciones, politica) {
  if (politica === 'primera') return opciones[0];
  if (politica === 'ultima') return opciones[opciones.length - 1];
  // "random" (default): Math.random ya está pisado por el PRNG con semilla.
  const indice = Math.floor(Math.random() * opciones.length);
  return opciones[indice];
}

// -----------------------------------------------------------------------
// 6. Instrumentación de aplicarDecisionYContinuar
// -----------------------------------------------------------------------
// ratingDelta y money SOLO pueden cambiar adentro de careerState.applyEffects,
// que aplicarDecisionYContinuar llama internamente. Envolvemos la función acá
// (en vez de tocar seasonOrchestrator.js, que no podemos modificar) para
// poder samplear esos dos valores justo después de resolver cada evento y así
// saber si en algún momento de la temporada tocaron un límite — al final de
// la temporada ya es tarde para chequear ratingDelta: avanzar() llama a
// resetRatingDeltaTemporada() antes de devolver SEASON_COMPLETE.
function aplicarDecisionYContinuarInstrumentado(argumentos, contexto) {
  const resultado = aplicarDecisionYContinuar(argumentos);
  const snapshot = careerState.getState();
  if (Math.abs(snapshot.ratingDelta) >= RATING_DELTA_CLAMP) contexto.ratingDeltaTocoClamp = true;
  if (snapshot.money === 0) contexto.dineroLlegoACero = true;
  return resultado;
}

// -----------------------------------------------------------------------
// 7. Una temporada completa
// -----------------------------------------------------------------------
function jugarTemporada({ temporadaNumero, ratingBase, moralInicial }) {
  const rivalesFuerza = generarRivalesFuerza(ratingBase);

  let estado = {
    ratingBase,
    moral: moralInicial,
    fatiga: FATIGA_INICIAL_POR_DEFECTO,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
    resultados: [],
    jornadaActual: 0,
    eventosDeTemporada: null,
  };

  let decisionPendiente = null;
  const eventosDisparados = [];
  const contexto = { ratingDeltaTocoClamp: false, dineroLlegoACero: false };

  while (true) {
    let resultado;
    if (decisionPendiente) {
      resultado = aplicarDecisionYContinuarInstrumentado(
        { estado, decisionElegida: decisionPendiente, rivalesFuerza, eventosDisponibles },
        contexto
      );
    } else {
      resultado = simularHastaProximoEvento({ estado, rivalesFuerza, eventosDisponibles });
    }
    decisionPendiente = null;
    estado = resultado.estado;

    if (resultado.status === 'EVENT_TRIGGERED') {
      const evento = resultado.eventDetails.evento;
      const opcionElegida = elegirOpcion(evento.options, args.politica);
      eventosDisparados.push({
        slot: resultado.eventDetails.slot,
        matchday: resultado.eventDetails.matchday,
        titulo: evento.titulo,
        opcionElegida: opcionElegida.label,
      });
      decisionPendiente = opcionElegida;
      continue;
    }

    if (resultado.status === 'SEASON_COMPLETE') {
      break;
    }
  }

  const snapshotFinal = careerState.getState();
  const { posicionJugador } = calcularTablaFinal({ rivalesFuerza, resultadosJugador: estado.resultados });

  return {
    temporadaNumero,
    posicion: posicionJugador,
    puntos: estado.points,
    gf: estado.goalsFor,
    gc: estado.goalsAgainst,
    moral: estado.moral,
    fatiga: estado.fatiga,
    dinero: snapshotFinal.money,
    presion: snapshotFinal.pressure,
    racha: snapshotFinal.streak,
    eventosDisparados,
    ratingDeltaTocoClamp: contexto.ratingDeltaTocoClamp,
    dineroLlegoACero: contexto.dineroLlegoACero,
    moralOFatigaClavada:
      estado.moral === MORAL_FATIGA_MIN ||
      estado.moral === MORAL_FATIGA_MAX ||
      estado.fatiga === MORAL_FATIGA_MIN ||
      estado.fatiga === MORAL_FATIGA_MAX,
  };
}

// -----------------------------------------------------------------------
// 8. Una carrera completa (8 temporadas)
// -----------------------------------------------------------------------
function jugarCarrera(numeroDeCarrera) {
  careerState.initCareerState({
    managerId: `harness-manager-${numeroDeCarrera}`,
    seasonId: `harness-season-${numeroDeCarrera}`,
    money: DINERO_INICIAL,
    morale: MORAL_INICIAL_POR_DEFECTO,
    fatigue: FATIGA_INICIAL_POR_DEFECTO,
    pressure: PRESION_INICIAL,
    streak: STREAK_INICIAL,
  });

  let ratingBase = RATING_BASE_INICIAL;
  let moral = MORAL_INICIAL_POR_DEFECTO;
  const temporadas = [];

  for (let numero = 1; numero <= TOTAL_TEMPORADAS; numero++) {
    const resumenTemporada = jugarTemporada({
      temporadaNumero: numero,
      ratingBase,
      moralInicial: moral,
    });
    temporadas.push(resumenTemporada);

    careerState.resetRatingDeltaTemporada();
    moral = resumenTemporada.moral;
    ratingBase += MEJORA_POR_REFUERZO;
  }

  return { numeroDeCarrera, temporadas };
}

// -----------------------------------------------------------------------
// 9. Impresión de reportes
// -----------------------------------------------------------------------
function formatearNumero(valor) {
  return Math.round(valor).toLocaleString('es-AR');
}

function pad(valor, ancho) {
  return String(valor).padStart(ancho);
}

function imprimirTablaPorTemporada(temporadas) {
  const encabezado = [
    pad('temp', 4),
    pad('pos', 3),
    pad('pts', 3),
    pad('GF', 3),
    pad('GC', 3),
    pad('moral', 5),
    pad('fatiga', 6),
    pad('plata', 12),
    pad('presión', 7),
    pad('racha', 5),
    pad('eventos', 7),
  ].join(' | ');
  console.log(encabezado);
  console.log('-'.repeat(encabezado.length));

  for (const t of temporadas) {
    console.log(
      [
        pad(t.temporadaNumero, 4),
        pad(t.posicion, 3),
        pad(t.puntos, 3),
        pad(t.gf, 3),
        pad(t.gc, 3),
        pad(Math.round(t.moral), 5),
        pad(Math.round(t.fatiga), 6),
        pad(formatearNumero(t.dinero), 12),
        pad(Math.round(t.presion), 7),
        pad(t.racha, 5),
        pad(t.eventosDisparados.length, 7),
      ].join(' | ')
    );
  }
}

function promedio(valores) {
  return valores.reduce((suma, v) => suma + v, 0) / valores.length;
}

function imprimirAgregado(carreras) {
  // "Final" = temporada 8 (la última) de cada carrera: es el estado de
  // régimen de la carrera completa, no un promedio de las 8 temporadas.
  const finales = carreras.map((c) => c.temporadas[c.temporadas.length - 1]);

  const posiciones = finales.map((t) => t.posicion);
  const puntos = finales.map((t) => t.puntos);
  const dinero = finales.map((t) => t.dinero);
  const morales = finales.map((t) => t.moral);

  const reportarStat = (nombre, valores, formatear = (v) => Math.round(v)) => {
    console.log(
      `  ${nombre}: promedio ${formatear(promedio(valores))} | mínimo ${formatear(Math.min(...valores))} | máximo ${formatear(Math.max(...valores))}`
    );
  };

  console.log(`\nAgregado de ${carreras.length} carreras (temporada ${TOTAL_TEMPORADAS}, la última de cada carrera):`);
  reportarStat('Posición final', posiciones);
  reportarStat('Puntos', puntos);
  reportarStat('Plata final', dinero, formatearNumero);
  reportarStat('Moral final', morales);

  const carrerasConCampeon = carreras.filter((c) => c.temporadas.some((t) => t.posicion === 1)).length;
  const porcentajeCampeon = (100 * carrerasConCampeon) / carreras.length;
  console.log(`  % de carreras campeón alguna vez: ${porcentajeCampeon.toFixed(1)}%`);
}

function imprimirAlertas(carreras) {
  console.log('\n⚠ ALERTAS');
  const alertas = [];

  const todasLasTemporadas = carreras.flatMap((c) => c.temporadas);
  const totalTemporadas = todasLasTemporadas.length;

  const finales = carreras.map((c) => c.temporadas[c.temporadas.length - 1]);
  const dineroFinalPromedio = promedio(finales.map((t) => t.dinero));
  if (dineroFinalPromedio > DINERO_INICIAL * 10) {
    alertas.push(
      `la plata final promedio (${formatearNumero(dineroFinalPromedio)}) supera 10x la inicial (${formatearNumero(DINERO_INICIAL)}) — economía rota al alza`
    );
  }

  const carrerasConDineroEnCero = carreras.filter((c) => c.temporadas.some((t) => t.dineroLlegoACero)).length;
  const porcentajeDineroEnCero = (100 * carrerasConDineroEnCero) / carreras.length;
  if (porcentajeDineroEnCero > 30) {
    alertas.push(
      `la plata llegó a 0 en el ${porcentajeDineroEnCero.toFixed(1)}% de las carreras — economía rota a la baja`
    );
  }

  const temporadasConMoralOFatigaClavada = todasLasTemporadas.filter((t) => t.moralOFatigaClavada).length;
  const porcentajeClavada = (100 * temporadasConMoralOFatigaClavada) / totalTemporadas;
  if (porcentajeClavada > 50) {
    alertas.push(`moral o fatiga quedaron clavadas en 0/100 en el ${porcentajeClavada.toFixed(1)}% de las temporadas`);
  }

  const temporadasCampeon = todasLasTemporadas.filter((t) => t.posicion === 1).length;
  const porcentajeCampeonTemporadas = (100 * temporadasCampeon) / totalTemporadas;
  if (porcentajeCampeonTemporadas > 60) {
    alertas.push(`salió campeón en el ${porcentajeCampeonTemporadas.toFixed(1)}% de las temporadas — juego demasiado fácil`);
  }

  const temporadasPuesto15OPeor = todasLasTemporadas.filter((t) => t.posicion >= 15).length;
  const porcentajePuesto15OPeor = (100 * temporadasPuesto15OPeor) / totalTemporadas;
  if (porcentajePuesto15OPeor > 60) {
    alertas.push(`terminó en puesto 15 o peor en el ${porcentajePuesto15OPeor.toFixed(1)}% de las temporadas — demasiado difícil`);
  }

  const temporadasRatingDeltaClamp = todasLasTemporadas.filter((t) => t.ratingDeltaTocoClamp).length;
  const porcentajeRatingDeltaClamp = (100 * temporadasRatingDeltaClamp) / totalTemporadas;
  if (porcentajeRatingDeltaClamp > 30) {
    alertas.push(
      `ratingDelta tocó el clamp (±${RATING_DELTA_CLAMP}) en el ${porcentajeRatingDeltaClamp.toFixed(1)}% de las temporadas`
    );
  }

  if (alertas.length === 0) {
    console.log('✅ Sin alertas de balance');
  } else {
    for (const alerta of alertas) console.log(`  - ${alerta}`);
  }
}

// -----------------------------------------------------------------------
// 10. Main
// -----------------------------------------------------------------------
function main() {
  const carreras = [];
  for (let i = 1; i <= args.carreras; i++) {
    carreras.push(jugarCarrera(i));
  }

  console.log(
    `Simulación de carrera: ${args.carreras} carrera(s), semilla=${args.seed}, política=${args.politica}\n`
  );

  if (args.carreras === 1 || args.verbose) {
    for (const carrera of carreras) {
      if (args.carreras > 1) console.log(`\n--- Carrera ${carrera.numeroDeCarrera} ---`);
      imprimirTablaPorTemporada(carrera.temporadas);
    }
  }

  if (args.carreras > 1) {
    imprimirAgregado(carreras);
  }

  imprimirAlertas(carreras);
}

try {
  main();
  process.exit(0);
} catch (error) {
  console.error('simulate-career.js: la simulación terminó con un error:');
  console.error(error);
  process.exit(1);
}
