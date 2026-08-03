// seasonSimulator.js — motor de simulación de TEMPORADA (liga de 38 fechas).
//
// Acá no nos importa el relato del partido: solo nos interesa, para cada
// fecha, cuántos goles hizo cada equipo. Es lógica pura (nada de Supabase,
// nada de Phaser) para que se pueda testear aparte, tirando muchas temporadas
// simuladas y chequeando que los números salgan razonables.
//
// -----------------------------------------------------------------------
// LA FÓRMULA DE FUERZA
// -----------------------------------------------------------------------
//
//   fuerza = rating_del_11 + (moral / 10) - (fatiga / 10) + azar
//
// - rating_del_11 es el nivel "de papel" del plantel (mismo tipo de escala
//   0-99 que usan las cartas para pace/shooting/etc).
// - moral y fatiga viven en escala 0-100, así que dividirlas por 10 las deja
//   en un rango de ±10 puntos de fuerza: un plantel con la moral por las
//   nubes (100) suma 10 puntos, uno reventado de cansancio (fatiga 100)
//   resta 10. Es un empujón real, pero nunca alcanza para tapar una
//   diferencia grande de nivel entre dos planteles (que puede ser de 20-30+
//   puntos de rating).
// - azar representa el ruido de un partido puntual (un árbitro que cobra
//   raro, una pelota que pega en el palo y entra, un día inspirado del
//   arquero rival). Lo generamos con una distribución triangular
//   (Math.random() + Math.random() - 1), que concentra los valores cerca de
//   0 y hace cada vez más raro acercarse a los extremos: así, un resultado
//   sorpresa sigue siendo posible, pero no constante.
//
// Esa "fuerza" final de cada equipo (ya con azar incluido) es lo que se usa
// para calcular cuántos goles esperamos que meta cada uno en el partido
// (ver calcularLambdaDeGoles). Además, el lambda de goles queda siempre
// acotado entre LAMBDA_MIN y LAMBDA_MAX: por más que un equipo sea muchísimo
// mejor que el otro, el rival nunca queda con lambda 0 (siempre tiene aunque
// sea una changüita de hacer un gol), y el equipo fuerte nunca queda con un
// lambda tan absurdo que le garantice una goleada todas las veces. Eso es lo
// que permite que haya upsets ocasionales sin que sean el pan de cada día.

export const TOTAL_MATCHDAYS = 38;

const CANTIDAD_RIVALES = 19; // 19 rivales x ida y vuelta = 38 fechas

// --- Escala de rating (mismo 0-99 que usa el resto del juego) ---
const RATING_MIN = 40;
const RATING_MAX = 99;

// --- Ruido de un partido puntual ---
const AZAR_MAX_SWING = 8; // tope de cuánto puede mover el azar la fuerza de un equipo en un partido

// --- Ventaja de localía ---
const VENTAJA_LOCAL = 4; // puntos de fuerza extra por jugar de local

// --- Conversión de fuerza a goles esperados (lambda de Poisson) ---
const BASE_GOLES_ESPERADOS = 1.3; // goles esperados de un equipo contra un rival de igual fuerza
const DIVISOR_FUERZA_A_GOLES = 15; // cada 15 puntos de diferencia de fuerza mueven el lambda en 1 gol
const LAMBDA_MIN = 0.2; // ni el equipo más flojo del mundo puede quedar "sin chances"
const LAMBDA_MAX = 4.0; // ni el equipo más fuerte del mundo tiene una goleada asegurada

// --- Evolución de moral/fatiga a lo largo de la temporada ---
const MORAL_MIN = 0;
const MORAL_MAX = 100;
const MORAL_GANANDO = 8;
const MORAL_EMPATANDO = -2;
const MORAL_PERDIENDO = -10;

const FATIGA_MIN = 0;
const FATIGA_MAX = 100;
const FATIGA_INCREMENTO_POR_PARTIDO = 6; // desgaste de jugar la fecha
const FATIGA_RECUPERACION_RATE = 0.12; // % de la fatiga acumulada que se recupera entre fecha y fecha

// --- Reversión a la media de moral (mitiga el "pozo gravitacional": con la
// actualización fecha a fecha sin reversión, ~53% de las carreras terminaban
// con moral final <30 y sin recuperación posterior a cruzar ese umbral). k es
// la fracción de la distancia a MORAL_REVERSION_MEDIA que se revierte cada
// fecha, aplicada DESPUÉS del delta del resultado y ANTES de clampear a
// [MORAL_MIN, MORAL_MAX] (ver actualizarMoral). k=0 reproduce exactamente el
// comportamiento viejo (sin reversión).
//
// k=0.15 quedó fijado como default de producción tras comparar 0.05/0.10/0.15
// con el harness (scripts/simulate-career.js). Se resuelve en
// resolverKReversion(), que prioriza (1) el parámetro explícito que le llegue
// a simularTramo / simularTemporadaCompleta y, si no vino, (2) la env var
// MORAL_REVERSION_K — pensada para poder correr scripts/simulate-career.js con
// otros valores de k sin tocar código entre corridas
// (`MORAL_REVERSION_K=0.1 node ...`) — y por último (3)
// K_REVERSION_MEDIA_DEFAULT.
const MORAL_REVERSION_MEDIA = 50;
const K_REVERSION_MEDIA_DEFAULT = 0.15;

function resolverKReversion(kExplicito) {
  if (kExplicito !== undefined) return kExplicito;
  // typeof process !== 'undefined': este archivo también se bundlea para el
  // browser (Vite), donde no existe `process` salvo que algo lo polyfillee.
  if (typeof process !== 'undefined' && process.env && process.env.MORAL_REVERSION_K !== undefined) {
    return parseFloat(process.env.MORAL_REVERSION_K);
  }
  return K_REVERSION_MEDIA_DEFAULT;
}

// Punto de partida de moral/fatiga cuando se arranca un tramo sin estado
// previo. Mismos valores que las columnas seasons.morale / seasons.fatigue
// en la base para la temporada 1 de un manager recién creado (src/seasons.js
// los importa de acá en vez de duplicarlos).
export const MORAL_INICIAL_POR_DEFECTO = 70;
export const FATIGA_INICIAL_POR_DEFECTO = 0;

// --- Estimación de posición final en la tabla ---
const PUNTOS_POR_VICTORIA = 3;
const PUNTOS_POR_EMPATE = 1;
const PUNTOS_PROMEDIO_POR_PARTIDO = 1.3; // lo que saca "un equipo del montón" en una liga pareja
const DIVISOR_FUERZA_A_PUNTOS = 12;

// clamp limita un número para que no se pase de un mínimo y un máximo.
function clamp(valor, minimo, maximo) {
  return Math.max(minimo, Math.min(maximo, valor));
}

// -----------------------------------------------------------------------
// AZAR Y GOLES
// -----------------------------------------------------------------------

// generarAzarAcotado devuelve un número en [-AZAR_MAX_SWING, AZAR_MAX_SWING],
// pero con distribución triangular (no uniforme): sumamos dos random [0,1) y
// restamos 1, lo que da un rango [-1, 1] con forma de "techo a dos aguas"
// (mucho más denso cerca del 0 que en los extremos). Es la forma más simple
// de simular "esto casi siempre es un ruido chico, pero de vez en cuando es
// grande" sin tener que traer una librería de distribuciones normales.
function generarAzarAcotado() {
  const triangular = Math.random() + Math.random() - 1;
  return triangular * AZAR_MAX_SWING;
}

// calcularLambdaDeGoles convierte una diferencia de fuerza en el lambda
// (goles esperados) de Poisson para el equipo que tiene esa fuerza a favor.
// Cuanto mayor la diferencia, más lambda para el que va arriba... pero
// siempre acotado entre LAMBDA_MIN y LAMBDA_MAX (ver comentario de arriba).
function calcularLambdaDeGoles(diferenciaDeFuerza) {
  const lambda = BASE_GOLES_ESPERADOS + diferenciaDeFuerza / DIVISOR_FUERZA_A_GOLES;
  return clamp(lambda, LAMBDA_MIN, LAMBDA_MAX);
}

// sortearGoles tira un número de goles al azar siguiendo una distribución de
// Poisson con el lambda dado (algoritmo de Knuth). Poisson es la
// distribución de manual para "cantidad de eventos raros en un intervalo
// fijo" (acá: goles en 90 minutos), y da resultados con la misma cara que un
// marcador real: la mayoría de los partidos entre 0 y 3 goles por equipo,
// pero de vez en cuando sale una goleada.
function sortearGoles(lambda) {
  const limite = Math.exp(-lambda);
  let goles = 0;
  let productoAcumulado = 1;

  do {
    goles++;
    productoAcumulado *= Math.random();
  } while (productoAcumulado > limite);

  // Tope defensivo: con los lambda que manejamos (<=4) prácticamente nunca
  // se llega ni cerca de esto, pero lo dejamos como red de seguridad para
  // que un marcador nunca se vaya a un número ridículo.
  return Math.min(goles - 1, 9);
}

// simularJornada juega un partido suelto entre dos fuerzas ya calculadas
// (fuerzaLocal y fuerzaVisitante = rating_del_11 + moral/10 - fatiga/10 de
// cada equipo, sin azar todavía: el azar se agrega acá adentro, junto con la
// ventaja de localía). Devuelve el marcador { golesLocal, golesVisitante }.
export function simularJornada(fuerzaLocal, fuerzaVisitante) {
  const fuerzaLocalFinal = fuerzaLocal + VENTAJA_LOCAL + generarAzarAcotado();
  const fuerzaVisitanteFinal = fuerzaVisitante + generarAzarAcotado();

  const diferencia = fuerzaLocalFinal - fuerzaVisitanteFinal;

  const lambdaLocal = calcularLambdaDeGoles(diferencia);
  const lambdaVisitante = calcularLambdaDeGoles(-diferencia);

  return {
    golesLocal: sortearGoles(lambdaLocal),
    golesVisitante: sortearGoles(lambdaVisitante),
  };
}

// -----------------------------------------------------------------------
// GENERACIÓN DE RIVALES
// -----------------------------------------------------------------------

// generarRivalesAlrededorDe arma una lista de 19 fuerzas de rival,
// distribuidas alrededor de ratingPlantel: algunos rivales van a ser mejores
// que el plantel del jugador, otros peores, pero la mayoría queda cerca (una
// liga pareja, no 19 equipos al azar entre 40 y 99). Usamos el promedio de 3
// random en vez de uno solo para que la distribución se parezca más a una
// campana (más densa cerca del centro) que a un rango uniforme.
function generarRivalesAlrededorDe(ratingPlantel) {
  const SPREAD = 14; // qué tan lejos del rating del plantel pueden caer los rivales
  const rivales = [];

  for (let i = 0; i < CANTIDAD_RIVALES; i++) {
    const ruido = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    const fuerzaRival = Math.round(ratingPlantel + ruido * SPREAD);
    rivales.push(clamp(fuerzaRival, RATING_MIN, RATING_MAX));
  }

  return rivales;
}

// -----------------------------------------------------------------------
// EVOLUCIÓN DE MORAL Y FATIGA FECHA A FECHA
// -----------------------------------------------------------------------

// actualizarMoral sube o baja la moral según el resultado de la fecha que se
// acaba de jugar y después revierte una fracción k de esa moral hacia
// MORAL_REVERSION_MEDIA (ver comentario de la constante), siempre acotada
// entre MORAL_MIN y MORAL_MAX al final.
function actualizarMoral(moralActual, resultado, k) {
  const delta =
    resultado === 'win' ? MORAL_GANANDO : resultado === 'draw' ? MORAL_EMPATANDO : MORAL_PERDIENDO;
  const moralCruda = moralActual + delta;
  const moralConReversion = moralCruda + (MORAL_REVERSION_MEDIA - moralCruda) * k;
  return clamp(moralConReversion, MORAL_MIN, MORAL_MAX);
}

// actualizarFatiga suma el desgaste de jugar la fecha y después recupera un
// % de la fatiga acumulada (representa el descanso y la rotación de plantel
// entre una fecha y la siguiente). A propósito NO es una resta fija: restar
// un número fijo cada vez hace que la fatiga termine pegada al techo
// (FATIGA_MAX) durante la mayor parte de la temporada apenas el desgaste le
// gana por poco a la recuperación, castigando a cualquier plantel por igual
// sin importar su nivel. Recuperando un porcentaje, en cambio, la fatiga se
// estabiliza sola en un valor de equilibrio moderado (deja de subir cuando
// lo que recupera esa fecha iguala al desgaste de jugarla).
function actualizarFatiga(fatigaActual) {
  const fatigaConDesgaste = fatigaActual + FATIGA_INCREMENTO_POR_PARTIDO;
  const fatigaConRecuperacion = fatigaConDesgaste * (1 - FATIGA_RECUPERACION_RATE);
  return clamp(fatigaConRecuperacion, FATIGA_MIN, FATIGA_MAX);
}

// -----------------------------------------------------------------------
// POSICIÓN FINAL EN LA TABLA
// -----------------------------------------------------------------------

// estimarPuntosDeRival calcula, sin simular partido por partido, cuántos
// puntos "debería" sacar en la temporada un rival de fuerza dada. No
// simulamos los 19x19 cruces entre rivales (eso sería un simulador de liga
// completo, fuera del alcance de esta tarea), así que aproximamos: un rival
// más fuerte que el plantel saca más puntos que el promedio de una liga
// pareja (PUNTOS_PROMEDIO_POR_PARTIDO), uno más flojo saca menos.
function estimarPuntosDeRival(fuerzaRival, ratingPlantel) {
  const diferencia = fuerzaRival - ratingPlantel;
  const puntosPorPartido = clamp(
    PUNTOS_PROMEDIO_POR_PARTIDO + diferencia / DIVISOR_FUERZA_A_PUNTOS,
    0,
    PUNTOS_POR_VICTORIA
  );
  return puntosPorPartido * TOTAL_MATCHDAYS;
}

// calcularPosicionFinal ubica al plantel en la tabla de 20 (él + 19
// rivales), comparando sus puntos reales contra los puntos estimados de cada
// rival. Es una aproximación a propósito: la posición exacta dependería de
// simular la liga completa, pero para nuestro resumen de temporada alcanza
// con saber "más o menos dónde quedaste".
function calcularPosicionFinal(puntosReales, rivales, ratingPlantel) {
  const rivalesQueTerminanArriba = rivales.filter(
    (fuerzaRival) => estimarPuntosDeRival(fuerzaRival, ratingPlantel) > puntosReales
  ).length;

  return clamp(rivalesQueTerminanArriba + 1, 1, CANTIDAD_RIVALES + 1);
}

// -----------------------------------------------------------------------
// MOMENTOS DESTACADOS (para el resumen largo de la temporada)
// -----------------------------------------------------------------------

// encontrarRachaMasLarga recorre los resultados en orden y devuelve la racha
// más larga de fechas consecutivas que cumplen `entraEnLaRacha` (por
// ejemplo, "no perdió" o "ganó"), junto con en qué fecha arrancó y en cuál
// terminó.
function encontrarRachaMasLarga(resultados, entraEnLaRacha) {
  let mejor = { largo: 0, desde: null, hasta: null };
  let actual = { largo: 0, desde: null };

  for (const resultado of resultados) {
    if (entraEnLaRacha(resultado)) {
      if (actual.largo === 0) actual.desde = resultado.jornada;
      actual.largo++;
      if (actual.largo > mejor.largo) {
        mejor = { largo: actual.largo, desde: actual.desde, hasta: resultado.jornada };
      }
    } else {
      actual = { largo: 0, desde: null };
    }
  }

  return mejor;
}

// construirMomentosDestacados arma los 4-6 hitos de la temporada que se usan
// para escribir el resumen largo: mejor victoria, peor derrota, racha
// ganadora más larga, racha invicta más larga y peor racha sin ganar.
export function construirMomentosDestacados(resultados) {
  const momentos = [];

  const victorias = resultados.filter((r) => r.resultado === 'win');
  const derrotas = resultados.filter((r) => r.resultado === 'loss');

  if (victorias.length > 0) {
    const mejorVictoria = victorias.reduce((mejor, actual) => {
      const diferenciaActual = actual.golesPlantel - actual.golesRival;
      const diferenciaMejor = mejor.golesPlantel - mejor.golesRival;
      return diferenciaActual > diferenciaMejor ? actual : mejor;
    });
    momentos.push({
      tipo: 'mejorVictoria',
      jornada: mejorVictoria.jornada,
      resultado: `${mejorVictoria.golesPlantel}-${mejorVictoria.golesRival}`,
      descripcion: `Mejor victoria: ${mejorVictoria.golesPlantel}-${mejorVictoria.golesRival} de ${
        mejorVictoria.esLocal ? 'local' : 'visitante'
      } en la fecha ${mejorVictoria.jornada}, ante un rival de fuerza ${mejorVictoria.rivalFuerza}.`,
    });
  }

  if (derrotas.length > 0) {
    const peorDerrota = derrotas.reduce((peor, actual) => {
      const diferenciaActual = actual.golesRival - actual.golesPlantel;
      const diferenciaPeor = peor.golesRival - peor.golesPlantel;
      return diferenciaActual > diferenciaPeor ? actual : peor;
    });
    momentos.push({
      tipo: 'peorDerrota',
      jornada: peorDerrota.jornada,
      resultado: `${peorDerrota.golesPlantel}-${peorDerrota.golesRival}`,
      descripcion: `Peor derrota: ${peorDerrota.golesPlantel}-${peorDerrota.golesRival} de ${
        peorDerrota.esLocal ? 'local' : 'visitante'
      } en la fecha ${peorDerrota.jornada}, ante un rival de fuerza ${peorDerrota.rivalFuerza}.`,
    });
  }

  const rachaGanadora = encontrarRachaMasLarga(resultados, (r) => r.resultado === 'win');
  if (rachaGanadora.largo > 0) {
    momentos.push({
      tipo: 'rachaGanadoraMasLarga',
      largo: rachaGanadora.largo,
      desde: rachaGanadora.desde,
      hasta: rachaGanadora.hasta,
      descripcion: `Racha ganadora más larga: ${rachaGanadora.largo} partidos seguidos ganados (fechas ${rachaGanadora.desde} a ${rachaGanadora.hasta}).`,
    });
  }

  const rachaInvicta = encontrarRachaMasLarga(resultados, (r) => r.resultado !== 'loss');
  if (rachaInvicta.largo > 0) {
    momentos.push({
      tipo: 'rachaInvictaMasLarga',
      largo: rachaInvicta.largo,
      desde: rachaInvicta.desde,
      hasta: rachaInvicta.hasta,
      descripcion: `Racha invicta más larga: ${rachaInvicta.largo} partidos seguidos sin perder (fechas ${rachaInvicta.desde} a ${rachaInvicta.hasta}).`,
    });
  }

  const rachaSinGanar = encontrarRachaMasLarga(resultados, (r) => r.resultado !== 'win');
  if (rachaSinGanar.largo > 0) {
    momentos.push({
      tipo: 'peorRachaSinGanar',
      largo: rachaSinGanar.largo,
      desde: rachaSinGanar.desde,
      hasta: rachaSinGanar.hasta,
      descripcion: `Peor racha sin ganar: ${rachaSinGanar.largo} partidos seguidos sin ganar (fechas ${rachaSinGanar.desde} a ${rachaSinGanar.hasta}).`,
    });
  }

  return momentos;
}

// -----------------------------------------------------------------------
// SIMULACIÓN POR TRAMOS
// -----------------------------------------------------------------------

// esListaDeRivalesValida dice si lo que nos pasaron sirve como liga: un array
// con exactamente las 19 fuerzas. Se usa en dos lados (para decidir si hay que
// generar una liga nueva y para el chequeo de tramo continuado de
// simularTramo), así que la condición vive en un solo lugar.
function esListaDeRivalesValida(rivalesFuerza) {
  return Array.isArray(rivalesFuerza) && rivalesFuerza.length === CANTIDAD_RIVALES;
}

// resolverRivales devuelve la lista de 19 fuerzas de rival a usar. Si el que
// llama pasó una lista válida se respeta tal cual (es lo que permite testear
// con una liga fija y determinística, y lo que permite que varios tramos de
// la MISMA temporada compartan los mismos rivales); si no, se genera una
// nueva alrededor del rating del plantel.
function resolverRivales(rivalesFuerza, ratingPlantel) {
  return esListaDeRivalesValida(rivalesFuerza)
    ? rivalesFuerza
    : generarRivalesAlrededorDe(ratingPlantel);
}

// crearEstadoInicial normaliza el `estado` que recibe simularTramo: completa
// con contadores en 0, resultados en [] y los defaults de moral/fatiga todo
// lo que no venga del tramo anterior. Devuelve SIEMPRE un objeto nuevo, así
// simularTramo nunca escribe sobre el estado que le pasaron.
function crearEstadoInicial(estado = {}) {
  return {
    ratingPlantel: estado.ratingPlantel,
    moral: estado.moral ?? MORAL_INICIAL_POR_DEFECTO,
    fatiga: estado.fatiga ?? FATIGA_INICIAL_POR_DEFECTO,
    wins: estado.wins ?? 0,
    draws: estado.draws ?? 0,
    losses: estado.losses ?? 0,
    goalsFor: estado.goalsFor ?? 0,
    goalsAgainst: estado.goalsAgainst ?? 0,
    points: estado.points ?? 0,
    // Copia: los resultados del tramo anterior se arrastran, pero los del
    // tramo nuevo se pushean acá y no en el array del que llama.
    resultados: [...(estado.resultados ?? [])],
  };
}

// simularTramo juega SOLO las fechas [desdeJornada, hastaJornada] (ambas
// inclusive) de la temporada y devuelve un estado nuevo con los contadores
// acumulados y moral/fatiga al corte del tramo. La matemática de cada fecha
// es exactamente la misma que la de una temporada completa: lo único que
// cambia es dónde arranca y dónde termina el loop.
//
// Parámetros:
//   - desdeJornada / hastaJornada: rango de fechas a jugar, 1-based e
//     INCLUSIVO en los dos extremos. Si hastaJornada < desdeJornada no se
//     simula nada y se devuelve una copia del estado (caso pretemporada).
//   - rivalesFuerza: lista de 19 fuerzas de rival. Es lo que garantiza que
//     todos los tramos de una misma temporada jueguen contra la misma liga.
//     Solo es opcional en el PRIMER tramo (desdeJornada === 1), que es el que
//     puede permitirse sortear una liga nueva; de la fecha 2 en adelante es
//     obligatoria y omitirla tira error (ver abajo).
//   - estado (opcional): lo que devolvió el tramo anterior. De acá sale
//     ratingPlantel y el punto de partida de moral/fatiga/contadores. En el
//     primer tramo alcanza con pasar { ratingPlantel } (y, si se quiere,
//     moral/fatiga distintos de los defaults).
//   - k (opcional): fracción de reversión a la media para actualizarMoral
//     (ver comentario de MORAL_REVERSION_MEDIA). Si no se pasa, se resuelve
//     con resolverKReversion (env var MORAL_REVERSION_K o el default).
//
// INDEXADO DE rivalesFuerza: la jornada es 1-based y el array 0-based, así
// que la jornada N enfrenta a rivalesFuerza[(N - 1) % 19]. Es decir:
// jornada 1 => rivalesFuerza[0], jornada 19 => rivalesFuerza[18], y la
// jornada 20 vuelve a rivalesFuerza[0] (la revancha de la fecha 1). La
// primera rueda (fechas 1-19) se juega de local y la segunda (20-38) de
// visitante, así cada rival aparece exactamente dos veces.
export function simularTramo({ desdeJornada, hastaJornada, rivalesFuerza, estado, k }) {
  const nuevoEstado = crearEstadoInicial(estado);
  const kReversion = resolverKReversion(k);

  // Tramo vacío (típicamente la pretemporada, antes de la fecha 1): copia sin
  // tocar nada. Ojo que esto se chequea ANTES de resolver rivales, para no
  // quemar azar generando una liga que no se va a usar.
  if (hastaJornada < desdeJornada) return nuevoEstado;

  // Un tramo que NO arranca en la fecha 1 es, por definición, la continuación
  // de una temporada que ya se venía jugando: la liga contra la que se juega
  // ya existe y hay que pasarla. Si no viene, resolverRivales sortearía una
  // liga NUEVA y el jugador terminaría enfrentando rivales distintos en la
  // segunda mitad del año sin que nadie se entere. Preferimos romper fuerte y
  // temprano antes que dejar pasar una temporada silenciosamente incoherente.
  if (desdeJornada > 1 && !esListaDeRivalesValida(rivalesFuerza)) {
    throw new Error(
      `simularTramo: hace falta rivalesFuerza con ${CANTIDAD_RIVALES} elementos para simular desde la jornada ${desdeJornada} ` +
        '(solo el primer tramo, desdeJornada === 1, puede generar una liga nueva). ' +
        'Pasá la MISMA lista en todos los tramos de la temporada.'
    );
  }

  const rivales = resolverRivales(rivalesFuerza, nuevoEstado.ratingPlantel);

  for (let jornada = desdeJornada; jornada <= hastaJornada; jornada++) {
    // Ver "INDEXADO DE rivalesFuerza" arriba: jornada 1 => rivales[0].
    const indiceRival = (jornada - 1) % CANTIDAD_RIVALES;
    const fuerzaRival = rivales[indiceRival];
    const esLocal = jornada <= CANTIDAD_RIVALES;

    const fuerzaPlantel = nuevoEstado.ratingPlantel + nuevoEstado.moral / 10 - nuevoEstado.fatiga / 10;

    const { golesLocal, golesVisitante } = esLocal
      ? simularJornada(fuerzaPlantel, fuerzaRival)
      : simularJornada(fuerzaRival, fuerzaPlantel);

    const golesPlantel = esLocal ? golesLocal : golesVisitante;
    const golesRival = esLocal ? golesVisitante : golesLocal;

    let resultado;
    if (golesPlantel > golesRival) {
      resultado = 'win';
      nuevoEstado.wins++;
      nuevoEstado.points += PUNTOS_POR_VICTORIA;
    } else if (golesPlantel === golesRival) {
      resultado = 'draw';
      nuevoEstado.draws++;
      nuevoEstado.points += PUNTOS_POR_EMPATE;
    } else {
      resultado = 'loss';
      nuevoEstado.losses++;
    }

    nuevoEstado.goalsFor += golesPlantel;
    nuevoEstado.goalsAgainst += golesRival;

    nuevoEstado.resultados.push({
      jornada,
      esLocal,
      rivalFuerza: fuerzaRival,
      golesPlantel,
      golesRival,
      resultado,
    });

    nuevoEstado.moral = actualizarMoral(nuevoEstado.moral, resultado, kReversion);
    nuevoEstado.fatiga = actualizarFatiga(nuevoEstado.fatiga);
  }

  return nuevoEstado;
}

// -----------------------------------------------------------------------
// FUNCIÓN PRINCIPAL: simularTemporadaCompleta
// -----------------------------------------------------------------------

// simularTemporadaCompleta juega las 38 fechas de una liga contra 19
// rivales (ida y vuelta) y devuelve el resumen de cómo le fue al plantel.
// Por dentro es un único tramo que va de la fecha 1 a la 38: la posición
// final y los momentos destacados se calculan recién sobre el estado final,
// porque solo tienen sentido con la temporada entera jugada.
//
// Parámetros:
//   - ratingPlantel: nivel "de papel" del plantel (rating_del_11).
//   - moralInicial / fatigaInicial: punto de partida (escala 0-100) de moral
//     y fatiga, que después van evolucionando fecha a fecha según los
//     resultados (ver actualizarMoral/actualizarFatiga).
//   - rivalesFuerza (opcional): lista de 19 números con la fuerza de cada
//     rival de la liga. Si no se pasa (o no tiene exactamente 19 elementos),
//     se genera una lista nueva distribuida alrededor de ratingPlantel (ver
//     generarRivalesAlrededorDe). Pasarla explícitamente es lo que permite
//     testear la función con una liga fija y determinística.
//   - k (opcional): fracción de reversión a la media que usa actualizarMoral
//     dentro del tramo (ver resolverKReversion / MORAL_REVERSION_MEDIA).
//
// No decide trofeos (campeón, descenso, etc): eso es la Tarea 3. Acá solo
// dejamos el resultado numérico de la temporada y los hitos para el relato.
export function simularTemporadaCompleta({ ratingPlantel, moralInicial, fatigaInicial, rivalesFuerza, k }) {
  // Los rivales se resuelven acá (y no adentro de simularTramo) porque
  // calcularPosicionFinal necesita la MISMA lista contra la que se jugó.
  const rivales = resolverRivales(rivalesFuerza, ratingPlantel);

  const estadoFinal = simularTramo({
    desdeJornada: 1,
    hastaJornada: TOTAL_MATCHDAYS,
    rivalesFuerza: rivales,
    estado: { ratingPlantel, moral: moralInicial, fatiga: fatigaInicial },
    k,
  });

  const { resultados } = estadoFinal;

  const league_position = calcularPosicionFinal(estadoFinal.points, rivales, ratingPlantel);
  const momentosDestacados = construirMomentosDestacados(resultados);

  return {
    wins: estadoFinal.wins,
    draws: estadoFinal.draws,
    losses: estadoFinal.losses,
    goals_for: estadoFinal.goalsFor,
    goals_against: estadoFinal.goalsAgainst,
    points: estadoFinal.points,
    league_position,
    momentosDestacados,
    // resultados: el detalle fecha a fecha (lo arma simularTramo).
    // Se expone además de momentosDestacados porque careerState.js
    // (src/state/careerState.js) lo necesita crudo para derivar el streak
    // ACTUAL al cierre del tramo (syncStreakFromResultados), algo distinto
    // de los hitos ya resumidos que arma construirMomentosDestacados.
    resultados,
    // moralFinal/fatigaFinal: cómo quedaron moral y fatiga después de jugar
    // las 38 fechas (moral/fatiga van cambiando fecha a fecha, ver
    // actualizarMoral/actualizarFatiga). Quien llama a esta función los
    // necesita para cerrar la fila de `seasons` y para heredarlos como punto
    // de partida de la temporada siguiente.
    moralFinal: estadoFinal.moral,
    fatigaFinal: estadoFinal.fatiga,
  };
}
