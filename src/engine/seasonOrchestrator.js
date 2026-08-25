// seasonOrchestrator.js — orquestador de los eventos de una temporada.
//
// seasonSimulator.js sabe jugar un tramo de fechas. eventSlots.js sabe en qué
// fechas cae un evento y cuál. Este archivo es el que los hace bailar juntos:
// avanza la temporada de corte en corte, frenando cada vez que hay un evento
// que necesita una decisión del jugador, y retomando cuando esa decisión ya
// fue tomada.
//
// Es 100% lógica pura: no importa Phaser ni Supabase. Sí importa careerState,
// que es un singleton en memoria (y ése sí toca Supabase, pero solo cuando
// alguien llama a su persist() — este archivo nunca lo hace).
//
// -----------------------------------------------------------------------
// EL ESTADO NO VIVE ACÁ
// -----------------------------------------------------------------------
//
// Las dos funciones exportadas son puras en el sentido que importa: reciben
// un `estado`, devuelven un `estado` nuevo, y nunca mutan el que les pasaron.
// El dueño del objeto es SeasonScene, que lo guarda entre llamada y llamada
// (mientras espera que el jugador toque una opción del modal).
//
// Forma del estado:
//   {
//     ratingBase,       // rating real del plantel. INMUTABLE durante la
//                       // temporada: el rating efectivo (con momentum de
//                       // streak y penalización de presión) se recalcula al
//                       // vuelo en cada tramo y NUNCA se escribe acá.
//     moral, fatiga,
//     wins, draws, losses, goalsFor, goalsAgainst, points,
//     resultados: [],
//     jornadaActual: 0,           // última jornada YA simulada (0 = no arrancó)
//     eventosDeTemporada: null,   // calendario de eventos; se sortea UNA sola vez
//   }
//
// -----------------------------------------------------------------------
// QUIÉN ES DUEÑO DE MORAL Y FATIGA
// -----------------------------------------------------------------------
//
// Misma división que ya declara careerState.js: DENTRO de un tramo mandan las
// fórmulas de seasonSimulator.js (moral sube/baja según cada resultado, fatiga
// se desgasta y recupera fecha a fecha). EN EL CORTE, cuando se resuelve un
// evento, manda careerState: applyEffects() aplica los deltas del catálogo y
// después nosotros copiamos morale/fatigue de vuelta al estado de la
// temporada. Por eso aplicarDecisionYContinuar sincroniza en ese orden y no al
// revés.
//
// Y al final de CUALQUIER corte (con evento o SEASON_COMPLETE), avanzar()
// vuelve a copiar moral/fatiga hacia careerState (ver BUG 3 FIX más abajo):
// es lo que le permite a SeasonScene confiar en careerState.getState() al
// cerrar la temporada, en vez de tener que acordarse de leer estado.moral a
// mano.
import { simularTramo, TOTAL_MATCHDAYS } from './seasonSimulator.js';
import { elegirEventosDeTemporada } from './eventSlots.js';
import * as careerState from '../state/careerState.js';
import { calcularTablaPorZona, obtenerClasificados } from './zonesTable.js';
import { simularPlayoffsCompletos } from './playoffsSimulator.js';

// -----------------------------------------------------------------------
// TRADUCCIÓN DE EFFECTS
// -----------------------------------------------------------------------
//
// El catálogo (events_catalog.options[].effects) guarda las claves con los
// nombres "de negocio" { morale, fatigue, money, rating_efectivo } — ver
// SeasonScene.aplicarEfectos —, mientras que careerState.applyEffects espera
// { moneyDelta, moraleDelta, fatigueDelta, pressureDelta, ratingDelta }. Si le pasáramos el
// objeto crudo del catálogo, applyEffects no reconocería ninguna clave y
// aplicaría 0 a todo EN SILENCIO (todos sus parámetros tienen default 0), que
// es la peor forma posible de fallar: el evento parecería resolverse bien y no
// haría nada.
//
// Así que traducimos acá. Aceptamos las dos convenciones para que sirva tanto
// si el catálogo trae { money: -500000 } como si alguien ya normalizó a
// { moneyDelta: -500000 }.
//
// rating_efectivo va a careerState.ratingDelta, que es el estado de gracia o
// crisis TEMPORAL del equipo esta temporada. Es un DELTA que se suma al
// ratingDelta ya acumulado (applyEffects suma, no reemplaza) y que
// getEffectiveRating suma al ratingBase junto con el momentum de streak y la
// penalización de presión. ratingBase sigue igual de inmutable que antes: el
// progreso de carrera a largo plazo no pasa por acá.
//
// OJO con una clave que queda afuera a propósito:
//   - streak: applyEffects no lo toca. El streak se deriva de los resultados
//     vía careerState.syncStreakFromResultados(), no de los deltas de un
//     evento.
function traducirEffects(effects = {}) {
  return {
    moneyDelta: effects.moneyDelta ?? effects.money ?? 0,
    moraleDelta: effects.moraleDelta ?? effects.morale ?? 0,
    fatigueDelta: effects.fatigueDelta ?? effects.fatigue ?? 0,
    pressureDelta: effects.pressureDelta ?? effects.pressure ?? 0,
    ratingDelta: effects.ratingDelta ?? effects.rating_efectivo ?? 0,
  };
}

// -----------------------------------------------------------------------
// STATS DEL TRAMO
// -----------------------------------------------------------------------

// calcularTramoStats saca "qué pasó en ESTE tramo" restando los acumuladores
// de antes a los de después. Los contadores del estado son acumulados de toda
// la temporada, pero para el resumen que muestra la pantalla entre evento y
// evento ("desde la fecha 8 a la 19 ganaste 6, empataste 2...") hace falta el
// delta, no el total.
function calcularTramoStats(estadoAntes, estadoDespues, desdeJornada, hastaJornada) {
  return {
    desdeJornada,
    hastaJornada,
    jornadasJugadas: Math.max(0, hastaJornada - desdeJornada + 1),
    wins: estadoDespues.wins - estadoAntes.wins,
    draws: estadoDespues.draws - estadoAntes.draws,
    losses: estadoDespues.losses - estadoAntes.losses,
    goalsFor: estadoDespues.goalsFor - estadoAntes.goalsFor,
    goalsAgainst: estadoDespues.goalsAgainst - estadoAntes.goalsAgainst,
    points: estadoDespues.points - estadoAntes.points,
    // Solo los resultados nuevos: el array del estado arrastra los de todos
    // los tramos anteriores, así que cortamos desde donde estaba.
    resultados: estadoDespues.resultados.slice(estadoAntes.resultados.length),
    // Cómo quedaron moral y fatiga al cierre del tramo (las mueve
    // seasonSimulator fecha a fecha).
    moralAlCorte: estadoDespues.moral,
    fatigaAlCorte: estadoDespues.fatiga,
  };
}

// -----------------------------------------------------------------------
// HELPER INTERNO: EL AVANCE
// -----------------------------------------------------------------------

// avanzar es la única implementación real del "seguí jugando hasta que pase
// algo". Las dos funciones exportadas terminan acá: simularHastaProximoEvento
// la llama directo, y aplicarDecisionYContinuar la llama después de aplicar la
// decisión. No dupliques esta lógica en ninguna de las dos.
function avanzar({ estado, rivalesFuerza, rivalesNombres, eventosDisponibles }) {
  // Copia defensiva: a partir de acá trabajamos sobre lo nuestro y el objeto
  // que nos pasó SeasonScene queda intacto.
  const estadoBase = { ...estado };

  // El calendario de eventos se sortea UNA sola vez por temporada, la primera
  // vez que se pide avanzar. Si lo re-sorteáramos en cada corte, los eventos
  // de la segunda mitad cambiarían después de cada decisión del jugador.
  if (estadoBase.eventosDeTemporada == null) {
    estadoBase.eventosDeTemporada = elegirEventosDeTemporada(eventosDisponibles ?? []);
  }

  // La próxima parada es la primera del calendario que todavía no pasamos.
  //
  // Ojo con lo que NO hay acá: no existe ningún caso de "corte sin evento".
  // elegirEventosDeTemporada ya descartó los slots que no le tocaron (y los
  // que no tenían ningún evento del catálogo elegible para su matchday), así
  // que lo que devuelve son SOLO fechas con evento. Un slot descartado
  // simplemente no está en el array y este find pasa de largo por encima sin
  // que quien nos llama se entere de que existía.
  const proximaParada = estadoBase.eventosDeTemporada.find(
    (parada) => parada.matchday > estadoBase.jornadaActual
  );

  const desdeJornada = estadoBase.jornadaActual + 1;
  // Sin próxima parada, se juega todo lo que queda hasta el final de la liga.
  // Con parada, se juega HASTA esa fecha inclusive: el evento se dispara
  // después de jugarse la jornada que lo marca (así, por ejemplo, el slot
  // ECUADOR de la fecha 19 aparece con la primera rueda ya terminada).
  const hastaJornada = proximaParada ? proximaParada.matchday : TOTAL_MATCHDAYS;

  // Rating efectivo AL VUELO: streak y pressure cambiaron desde el último
  // tramo, así que el rating con el que se juega este tramo se recalcula
  // ahora. Se lo pasamos a simularTramo como ratingPlantel y no se guarda en
  // ningún lado — ratingBase sigue siendo el rating real del plantel.
  const ratingPlantel = careerState.getEffectiveRating(estadoBase.ratingBase);

  const resultadoTramo = simularTramo({
    desdeJornada,
    hastaJornada,
    rivalesFuerza,
    rivalesNombres,
    estado: { ...estadoBase, ratingPlantel },
  });

  // simularTramo devuelve solo los campos que él administra (y con
  // ratingPlantel en vez de ratingBase), así que reconstruimos el estado
  // completo: partimos del nuestro —que conserva ratingBase y
  // eventosDeTemporada— y le pisamos encima lo que el tramo actualizó.
  const estadoActualizado = {
    ...estadoBase,
    moral: resultadoTramo.moral,
    fatiga: resultadoTramo.fatiga,
    wins: resultadoTramo.wins,
    draws: resultadoTramo.draws,
    losses: resultadoTramo.losses,
    goalsFor: resultadoTramo.goalsFor,
    goalsAgainst: resultadoTramo.goalsAgainst,
    points: resultadoTramo.points,
    resultados: resultadoTramo.resultados,
    // Math.max y no una asignación directa: si el tramo vino vacío
    // (hastaJornada < desdeJornada, que pasa cuando ya se jugaron las 38) no
    // queremos hacer retroceder el contador.
    jornadaActual: Math.max(estadoBase.jornadaActual, hastaJornada),
  };

  const tramoStats = calcularTramoStats(estadoBase, estadoActualizado, desdeJornada, hastaJornada);

  // BUG 2 FIX: el streak se deriva acá, en el único punto donde se cierra un
  // tramo, para que quede al día en careerState ANTES de que getEffectiveRating
  // vuelva a usarse (en el próximo avanzar(), para el tramo siguiente, o en el
  // cierre de temporada). Pasamos el array completo de resultados —no solo los
  // del tramo— porque syncStreakFromResultados ya recorre desde el final hacia
  // atrás y corta en el primer empate: le da lo mismo ver de más atrás.
  careerState.syncStreakFromResultados(estadoActualizado.resultados);

  // BUG 3 FIX: sin esto, careerState.morale/fatigue solo se ponía al día
  // dentro de aplicarDecisionYContinuar (paso 1, ANTES de jugar el tramo que
  // sigue a la decisión). Cuando el evento resuelto no caía justo en la
  // última fecha (SLOTS de eventSlots.js sortea entre 3 y 5 de los 5 slots
  // posibles, así que el de CIERRE/fecha 38 queda afuera ~1 de cada 5
  // temporadas), el tramo final se jugaba igual pero careerState nunca se
  // enteraba: quedaba con el valor de ANTES de esas fechas. SeasonScene lee
  // moral/fatiga de careerState.getState() para cerrarTemporada() y para
  // calcularResetParcialTemporada() (el heredado de la próxima temporada), así
  // que ese desfasaje se colaba silenciosamente a la base y a la temporada
  // siguiente. Sincronizando acá, en el único punto donde se cierra CUALQUIER
  // tramo (con o sin evento), careerState queda siempre al día con lo que
  // acaba de devolver seasonSimulator.
  careerState.syncMoraleFatigaDesdeTramo({ moral: estadoActualizado.moral, fatiga: estadoActualizado.fatiga });

  if (!proximaParada) {
    // Fin de temporada: el estado de gracia/crisis acumulado por los eventos
    // muere acá, así la próxima arranca desde el rating real del plantel. Es el
    // ÚNICO punto del archivo que llama al reset, y está en avanzar() —no en
    // las dos exportadas— porque las dos terminan pasando por esta rama: la
    // temporada se cierra tanto por simularHastaProximoEvento como por
    // aplicarDecisionYContinuar (de hecho, casi siempre por la segunda, cuando
    // el jugador resuelve el último evento y se juega el tramo final).
    //
    // Va después de calcular tramoStats y antes del return: el rating de este
    // último tramo ya se usó, y quien recibe el SEASON_COMPLETE lee un
    // ratingDelta en 0.
    careerState.resetRatingDeltaTemporada();
    return { status: 'SEASON_COMPLETE', estado: estadoActualizado, tramoStats };
  }

  return {
    status: 'EVENT_TRIGGERED',
    // eventDetails es la parada tal cual la arma eventSlots.js
    // ({ slot, matchday, evento }), sin envolverla ni renombrarle nada: el
    // evento concreto del catálogo ya lo eligió elegirEventosDeTemporada al
    // sortear el calendario, no hay una segunda elección que hacer acá.
    eventDetails: proximaParada,
    estado: estadoActualizado,
    tramoStats,
  };
}

// -----------------------------------------------------------------------
// API PÚBLICA
// -----------------------------------------------------------------------

// simularHastaProximoEvento juega desde donde quedó la temporada hasta el
// próximo evento (o hasta la fecha 38 si ya no queda ninguno).
//
// Parámetros:
//   - estado: el objeto descrito arriba. En la primera llamada alcanza con
//     { ratingBase, jornadaActual: 0, eventosDeTemporada: null } y el resto en
//     sus valores iniciales.
//   - rivalesFuerza: las 19 fuerzas de la liga. Pasar SIEMPRE la misma lista
//     en todas las llamadas de una temporada: es lo que garantiza que todos
//     los tramos se jueguen contra los mismos rivales (ver simularTramo).
//   - rivalesNombres (opcional): los 19 nombres de club en el mismo orden que
//     rivalesFuerza. Se limita a viajar hasta simularTramo, que los adjunta a
//     cada resultado; no cambia ninguna otra lógica del orquestador.
//   - eventosDisponibles: filas de events_catalog con active=true. Solo se usa
//     la primera vez (cuando hay que sortear el calendario); en los llamados
//     siguientes se ignora porque estado.eventosDeTemporada ya está armado.
//
// Devuelve:
//   { status: 'EVENT_TRIGGERED', eventDetails, estado, tramoStats }  o
//   { status: 'SEASON_COMPLETE', estado, tramoStats }
//
// PRECONDICIÓN: careerState.initCareerState() ya tiene que haberse llamado
// (usamos getEffectiveRating, que lee el estado en memoria).
export function simularHastaProximoEvento({ estado, rivalesFuerza, rivalesNombres, eventosDisponibles }) {
  return avanzar({ estado, rivalesFuerza, rivalesNombres, eventosDisponibles });
}

// aplicarDecisionYContinuar resuelve el evento que estaba esperando (aplicando
// los efectos de la opción que eligió el jugador) y sigue jugando hasta el
// próximo corte, en una sola llamada.
//
// Parámetros:
//   - estado: el `estado` que devolvió el EVENT_TRIGGERED anterior.
//   - decisionElegida: la opción del evento que tocó el jugador. De acá se usa
//     `.effects` (ver traducirEffects para las claves soportadas).
//   - rivalesFuerza / eventosDisponibles: igual que en
//     simularHastaProximoEvento.
//
// Devuelve exactamente lo mismo que simularHastaProximoEvento.
export function aplicarDecisionYContinuar({ estado, decisionElegida, rivalesFuerza, rivalesNombres, eventosDisponibles }) {
  // 1. BUG 1 FIX — sincronizar careerState con el snapshot más reciente de
  //    moral/fatiga ANTES de aplicar el efecto. `estado` es el que vino
  //    actualizándose tramo a tramo con los resultados de los partidos, así
  //    que puede estar más al día que careerState.morale/fatigue (que solo se
  //    tocan acá, en los cortes). Si aplicáramos el delta del evento sin este
  //    paso, se sumaría sobre un valor de careerState potencialmente viejo y
  //    pisaría en silencio la tendencia real que vino de los partidos.
  careerState.syncMoraleFatigaDesdeTramo({ moral: estado.moral, fatiga: estado.fatiga });

  // 2. Los deltas del evento van SIEMPRE por applyEffects: es el único camino
  //    autorizado para tocar money/morale/fatigue/pressure (regla de
  //    careerState.js). Acá no se clampea ni se suma nada a mano. Ahora sí
  //    parte del valor ya sincronizado en el paso 1.
  careerState.applyEffects(traducirEffects(decisionElegida?.effects));

  // 3. Sincronización de vuelta: en el corte, careerState es la fuente de
  //    verdad de moral y fatiga (acaba de aplicarles el evento y de
  //    clampearlas), así que las copiamos al estado de la temporada antes de
  //    seguir. De la fecha siguiente en adelante vuelve a mandar
  //    seasonSimulator. Nótese el cambio de idioma de las claves:
  //    careerState habla en inglés (morale/fatigue), el estado de temporada en
  //    castellano (moral/fatiga).
  const { morale, fatigue } = careerState.getState();
  const estadoSincronizado = { ...estado, moral: morale, fatiga: fatigue };

  // 4. Y a partir de acá es exactamente el mismo avance de siempre.
  return avanzar({ estado: estadoSincronizado, rivalesFuerza, rivalesNombres, eventosDisponibles });
}

// -----------------------------------------------------------------------
// LIGAS CON PLAY-OFFS (Liga Profesional Argentina)
// -----------------------------------------------------------------------

// simularTemporadaConPlayoffs coordina una liga con formato de zonas + play-offs:
//   1. Fase regular por zonas (16 fechas)
//   2. Clasificación de los 8 mejores de cada zona
//   3. Play-offs de eliminación directa (octavos → final)
//
// Parámetros:
//   - ligaConfig: objeto de leagues.js con { tienePlayoffs, equiposPorZona, etc. }
//   - clubJugador: nombre del club del jugador
//   - estado: estado inicial de temporada (igual que simularHastaProximoEvento)
//   - eventosDisponibles: catálogo de eventos (opcional en fase regular)
//
// Devuelve:
//   {
//     status: 'CLASIFICO_PLAYOFFS' | 'ELIMINADO_FASE_REGULAR' | 'CAMPEON' | 'ELIMINADO_PLAYOFFS',
//     faseRegular: { tablaZonaA, tablaZonaB, posicionJugador, clasificados },
//     playoffs: { bracket, campeon, eliminadoEn } | null,
//     estado: estado final de temporada,
//   }
export function simularTemporadaConPlayoffs({
  ligaConfig,
  clubJugador,
  estado,
  eventosDisponibles = [],
}) {
  // 1. Calcular tabla de la fase regular por zonas
  const { tablaZonaA, tablaZonaB } = calcularTablaPorZona({
    equipos: ligaConfig.clubs.map(c => c.name),
    zonas: ligaConfig.clubs.reduce((acc, c) => {
      acc[c.name] = c.zona;
      return acc;
    }, {}),
    clubJugador,
    ratingPlantel: careerState.getEffectiveRating(),
    moral: estado.moral ?? 50,
    fatiga: estado.fatiga ?? 50,
    presion: careerState.getState().pressure ?? 0,
    matchdays: ligaConfig.faseRegularMatchdays,
  });

  // 2. Determinar en qué zona está el jugador
  const zonaJugador = ligaConfig.clubs.find(c => c.name === clubJugador)?.zona;
  const tablaJugador = zonaJugador === 'A' ? tablaZonaA : tablaZonaB;
  const equipoJugador = tablaJugador.find(eq => eq.nombre === clubJugador);
  const posicionJugador = equipoJugador?.posicion ?? 99;

  // 3. Obtener los 16 clasificados (8 por zona)
  const clasificados = obtenerClasificados({
    tablaZonaA,
    tablaZonaB,
    cantidadPorZona: ligaConfig.clasificadosPorZona,
  });

  // 4. Verificar si el jugador clasificó
  const jugadorClasifica = posicionJugador <= ligaConfig.clasificadosPorZona;

  if (!jugadorClasifica) {
    return {
      status: 'ELIMINADO_FASE_REGULAR',
      faseRegular: {
        tablaZonaA,
        tablaZonaB,
        posicionJugador,
        clasificados,
      },
      playoffs: null,
      estado: {
        ...estado,
        wins: equipoJugador.ganados,
        draws: equipoJugador.empatados,
        losses: equipoJugador.perdidos,
        goalsFor: equipoJugador.golesFavor,
        goalsAgainst: equipoJugador.golesContra,
        points: equipoJugador.puntos,
        jornadaActual: ligaConfig.faseRegularMatchdays,
      },
    };
  }

  // 5. Simular play-offs
  const resultadoPlayoffs = simularPlayoffsCompletos({
    clasificados,
    clubJugador,
    estadoJugador: {
      moral: estado.moral ?? 50,
      fatiga: estado.fatiga ?? 50,
    },
  });

  // 6. Determinar resultado final
  const esCampeon = resultadoPlayoffs.campeon.nombre === clubJugador;
  const status = esCampeon ? 'CAMPEON' : 'ELIMINADO_PLAYOFFS';

  return {
    status,
    faseRegular: {
      tablaZonaA,
      tablaZonaB,
      posicionJugador,
      clasificados,
    },
    playoffs: resultadoPlayoffs,
    estado: {
      ...estado,
      wins: equipoJugador.ganados,
      draws: equipoJugador.empatados,
      losses: equipoJugador.perdidos,
      goalsFor: equipoJugador.golesFavor,
      goalsAgainst: equipoJugador.golesContra,
      points: equipoJugador.puntos,
      jornadaActual: ligaConfig.faseRegularMatchdays,
    },
  };
}
