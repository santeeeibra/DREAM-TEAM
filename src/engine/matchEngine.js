// matchEngine.js — motor de simulación de partido.
//
// Este archivo simula un partido de fútbol de 90 minutos, tramo por tramo,
// tirando "dados" (números random) para decidir si hay goles (y también
// palos, atajadas y ocasiones falladas, para que el relato tenga más vida),
// y dejando que el jugador (equipo local) tome decisiones tácticas en dos
// momentos del partido (minuto 30 y minuto 60) que afectan un poco las
// probabilidades.
//
// Además de eso, el motor guarda un "estado" del partido (matchState) con
// la táctica y la formación activa de cada equipo, y cuántas sustituciones
// le quedan al equipo local. Ese estado se puede ir tocando desde afuera
// (por ejemplo, desde botones de la UI) mientras el partido se sigue
// jugando, y el motor lo vuelve a leer en cada tramo nuevo.
//
// No hay nada de gráficos ni de UI acá: es lógica pura. La función principal
// es "async" y avisa lo que va pasando a través de "callbacks" (funciones que
// le pasa quien use el motor). Así, una escena de Phaser puede engancharse a
// cada evento y decisión para animarlos en pantalla, esperando (await) a que
// la animación termine antes de que el motor siga generando lo que sigue del
// partido. Si no se pasa ningún callback, el motor simplemente simula todo
// de una, sin esperar nada (es lo que hace nuestro script de test en consola).

// -----------------------------------------------------------------------
// MAZO DE TÁCTICAS
// -----------------------------------------------------------------------

// TACTICS es la lista de tácticas que se le pueden aplicar a un equipo.
// atk/def son multiplicadores: 1.00 es "normal", más alto favorece a ese
// lado. occasionMod (opcional) ajusta cuántas ocasiones extra sin gol genera
// el equipo con esa táctica activa. possessionBased (opcional) hace que el
// reparto de esas ocasiones extra dependa del passing del equipo en vez de
// repartirse ~parejo con el rival (ver repartirOcasionesExtra más abajo).
// extraFatigue (opcional) queda anotado en la táctica para una futura
// mecánica de cansancio: todavía no está implementada en esta iteración.
export const TACTICS = {
  orden: { label: 'Orden', atk: 1.0, def: 1.0 },
  bloqueBajo: { label: 'Bloque bajo / repliegue', atk: 0.75, def: 1.3, occasionMod: 0.8 },
  tresDelant: { label: 'Tres delanteros', atk: 1.25, def: 0.85 },
  todosArriba: { label: 'Todos arriba', atk: 1.45, def: 0.6 },
  posesion: { label: 'Jugar por posesión', atk: 1.0, def: 1.0, occasionMod: 0.7, possessionBased: true },
  presionAlta: { label: 'Presión alta', atk: 1.15, def: 0.9, extraFatigue: true },
};

// A cada equipo le mostramos 3 tácticas según cómo está el marcador, más
// 'orden' que siempre va como cuarta opción fija (para poder volver al
// esquema neutro en cualquier momento).
const TACTICAS_SEGUN_SITUACION = {
  perdiendo: ['tresDelant', 'todosArriba', 'posesion'],
  empatando: ['posesion', 'tresDelant', 'presionAlta'],
  ganando: ['bloqueBajo', 'posesion', 'presionAlta'],
};

// -----------------------------------------------------------------------
// FORMACIONES
// -----------------------------------------------------------------------

// FORMATIONS es la lista de formaciones que puede usar un equipo. Al igual
// que las tácticas, atk/def son multiplicadores sobre el poder de ataque y
// defensa del equipo.
export const FORMATIONS = {
  '4-4-2': { label: '4-4-2 (equilibrado)', atk: 1.0, def: 1.0 },
  '4-3-3': { label: '4-3-3 (ofensivo)', atk: 1.15, def: 0.9 },
  '3-5-2': { label: '3-5-2 (mediocampo)', atk: 1.05, def: 0.95 },
  '5-3-2': { label: '5-3-2 (defensivo)', atk: 0.85, def: 1.2 },
};

// -----------------------------------------------------------------------
// PASO 1: fuerzas del equipo
// -----------------------------------------------------------------------

// attackPower calcula qué tan fuerte es el ataque de un equipo.
// Toma solo a los mediocampistas ('MED') y delanteros ('DEL'), porque son
// los que participan del ataque, y promedia (pace + shooting + passing) / 3
// de cada uno de ellos.
function attackPower(team) {
  const jugadoresDeAtaque = team.players.filter(
    (jugador) => jugador.position === 'MED' || jugador.position === 'DEL'
  );

  // Si por algún motivo el equipo no tiene jugadores de ataque, devolvemos 0
  // para no dividir por cero.
  if (jugadoresDeAtaque.length === 0) return 0;

  const sumaDePoder = jugadoresDeAtaque.reduce((acumulado, jugador) => {
    const poderDelJugador = (jugador.pace + jugador.shooting + jugador.passing) / 3;
    return acumulado + poderDelJugador;
  }, 0);

  return sumaDePoder / jugadoresDeAtaque.length;
}

// defensePower calcula qué tan fuerte es la defensa de un equipo.
// Combina el promedio de los defensores ('DEF') con el nivel del arquero
// ('POR'): 60% el promedio de los defensores, 40% el goalkeeping del arquero.
function defensePower(team) {
  const defensores = team.players.filter((jugador) => jugador.position === 'DEF');

  const promedioDefensores =
    defensores.length === 0
      ? 0
      : defensores.reduce((acumulado, jugador) => {
          return acumulado + (jugador.defense + jugador.physical) / 2;
        }, 0) / defensores.length;

  const arquero = obtenerArquero(team);
  const goalkeeping = arquero ? arquero.goalkeeping : 0;

  return promedioDefensores * 0.6 + goalkeeping * 0.4;
}

// passingPromedio calcula el passing promedio de todo el equipo (los 11 en
// cancha). Lo usamos para repartir las ocasiones extra cuando un equipo
// juega con una táctica "por posesión" (ver repartirOcasionesExtra).
function passingPromedio(team) {
  if (team.players.length === 0) return 0;
  const sumaDePassing = team.players.reduce((acumulado, jugador) => acumulado + jugador.passing, 0);
  return sumaDePassing / team.players.length;
}

// obtenerArquero busca al arquero ('POR') de un equipo, para reusarlo tanto
// en el cálculo de defensePower como para saber quién ataja los tiros.
function obtenerArquero(team) {
  return team.players.find((jugador) => jugador.position === 'POR');
}

// obtenerAtacantes devuelve la lista de mediocampistas y delanteros de un
// equipo, que son quienes generan las jugadas de ataque (goles, palos, etc).
function obtenerAtacantes(team) {
  return team.players.filter(
    (jugador) => jugador.position === 'MED' || jugador.position === 'DEL'
  );
}

// elegirAlAzar devuelve un elemento cualquiera de una lista (o undefined si
// la lista está vacía).
function elegirAlAzar(lista) {
  if (lista.length === 0) return undefined;
  return lista[Math.floor(Math.random() * lista.length)];
}

// -----------------------------------------------------------------------
// PASO 1B: poder de ataque/defensa de un tramo, con formación + táctica
// -----------------------------------------------------------------------

// calcularAtkTotal y calcularDefTotal combinan las stats "crudas" del equipo
// (attackPower/defensePower) con los multiplicadores de la formación activa
// y de la táctica activa, para tener el poder real de ese equipo en el
// tramo que se está por simular.
function calcularAtkTotal(equipo, formationKey, tactica) {
  const formacion = FORMATIONS[formationKey] || FORMATIONS['4-4-2'];
  return attackPower(equipo) * formacion.atk * tactica.atk;
}

function calcularDefTotal(equipo, formationKey, tactica) {
  const formacion = FORMATIONS[formationKey] || FORMATIONS['4-4-2'];
  return defensePower(equipo) * formacion.def * tactica.def;
}

// -----------------------------------------------------------------------
// PASO 2: probabilidad de gol por tramo
// -----------------------------------------------------------------------

// Los 4 tramos en los que dividimos el partido. Cada uno es [minutoInicio, minutoFin].
const TRAMOS = [
  [0, 30],
  [30, 60],
  [60, 75],
  [75, 90],
];

// clamp limita un número para que no se pase de un mínimo y un máximo.
function clamp(valor, minimo, maximo) {
  return Math.max(minimo, Math.min(maximo, valor));
}

// calcularProbabilidadGol devuelve, entre 0.05 y 0.6, la chance de que un
// equipo haga un gol en este tramo, comparando su atkTotal (ya con
// formación y táctica aplicadas) contra el defTotal del rival.
function calcularProbabilidadGol(atkTotal, defTotalRival) {
  const base = (atkTotal - defTotalRival + 50) / 200;
  return clamp(base, 0.05, 0.6);
}

// randomMinuto elige un minuto al azar dentro del rango [inicio, fin) de un tramo.
function randomMinuto(inicio, fin) {
  return Math.floor(inicio + Math.random() * (fin - inicio));
}

// -----------------------------------------------------------------------
// PASO 3: ocasiones sin gol (palo, atajada, tiro afuera)
// -----------------------------------------------------------------------

// Además del tiro "importante" que decide si hay gol o no en el tramo (ver
// calcularProbabilidadGol), generamos algunas ocasiones extra sin gol, solo
// para que el relato del partido tenga más variedad de eventos (post/save/miss).
// Cada una tiene un "peso": cuanto más alto, más chances de que salga elegida.
const TIPOS_DE_OCASION_SIN_GOL = [
  { tipo: 'post', peso: 15 },
  { tipo: 'save', peso: 55 },
  { tipo: 'miss', peso: 30 },
];

// elegirTipoDeOcasionSinGol hace un sorteo pesado (weighted random) entre
// palo / atajada / tiro afuera.
function elegirTipoDeOcasionSinGol() {
  const pesoTotal = TIPOS_DE_OCASION_SIN_GOL.reduce((acumulado, item) => acumulado + item.peso, 0);
  let tiro = Math.random() * pesoTotal;

  for (const item of TIPOS_DE_OCASION_SIN_GOL) {
    if (tiro < item.peso) return item.tipo;
    tiro -= item.peso;
  }

  return 'miss';
}

// repartirOcasionesExtra decide cuántas ocasiones extra (sin gol) le tocan a
// cada equipo en este tramo. Por defecto se reparten ~parejo entre los dos
// (proporción 0.5 y 0.5), pero si alguno de los dos juega con una táctica
// "por posesión" (possessionBased), el reparto pasa a depender del passing
// de cada equipo contra el del rival: el que pasa mejor la pelota, se queda
// con más ocasiones.
function repartirOcasionesExtra(homeSquad, awaySquad, tacticaHome, tacticaAway) {
  let proporcionHome = 0.5;

  if (tacticaHome.possessionBased || tacticaAway.possessionBased) {
    const passingHome = passingPromedio(homeSquad);
    const passingAway = passingPromedio(awaySquad);
    const totalPassing = passingHome + passingAway;
    proporcionHome = totalPassing > 0 ? passingHome / totalPassing : 0.5;
  }

  // Pozo total de ocasiones extra del tramo (entre 1 y 4), que después se
  // reparte entre los dos equipos según la proporción calculada arriba.
  const pozoTotal = 1 + Math.floor(Math.random() * 4);
  const ocasionesHome = Math.round(pozoTotal * proporcionHome);
  const ocasionesAway = pozoTotal - ocasionesHome;

  return { home: ocasionesHome, away: ocasionesAway };
}

// -----------------------------------------------------------------------
// PASO 4: decisiones tácticas
// -----------------------------------------------------------------------

// obtenerClavesDeTacticasParaMarcador arma la lista de claves de TACTICS
// para ofrecerle al jugador en el panel de decisión: 3 según cómo viene el
// marcador (perdiendo/empatando/ganando) + 'orden' siempre como cuarta
// opción fija.
function obtenerClavesDeTacticasParaMarcador(marcador) {
  let situacion;
  if (marcador.home < marcador.away) situacion = 'perdiendo';
  else if (marcador.home > marcador.away) situacion = 'ganando';
  else situacion = 'empatando';

  return [...TACTICAS_SEGUN_SITUACION[situacion], 'orden'];
}

// contarGoles recorre los eventos ocurridos hasta ahora y cuenta cuántos
// goles hizo cada equipo, para saber el marcador en un momento dado.
function contarGoles(eventos) {
  const marcador = { home: 0, away: 0 };
  for (const evento of eventos) {
    if (evento.type === 'goal') {
      marcador[evento.team] += 1;
    }
  }
  return marcador;
}

// describirSituacion arma el texto que ve el jugador como título del panel
// de decisión, según cómo está el marcador en ese momento.
function describirSituacion(marcador) {
  if (marcador.home < marcador.away) return `Vas perdiendo ${marcador.home}-${marcador.away}. ¿Qué hacemos?`;
  if (marcador.home > marcador.away) return `Vas ganando ${marcador.home}-${marcador.away}. ¿Qué hacemos?`;
  return `Están empatando ${marcador.home}-${marcador.away}. ¿Qué hacemos?`;
}

// -----------------------------------------------------------------------
// PASO 5: armar cada evento (con su texto para mostrar en el relato)
// -----------------------------------------------------------------------

// nombreDeEquipo devuelve el nombre del equipo si lo tiene (squad.name),
// o si no, un nombre genérico según si es local o visitante.
function nombreDeEquipo(equipoId, homeSquad, awaySquad) {
  if (equipoId === 'home') return homeSquad.name || 'Local';
  return awaySquad.name || 'Visitante';
}

// crearEventoDeTiro arma un evento de gol/palo/atajada/tiro afuera.
// equipoQueAtaca es 'home' o 'away': el equipo dueño de la ocasión.
// tipo: 'goal' | 'post' | 'save' | 'miss'.
function crearEventoDeTiro(tipo, minuto, equipoQueAtaca, homeSquad, awaySquad) {
  const equipoAtacante = equipoQueAtaca === 'home' ? homeSquad : awaySquad;
  const equipoDefensor = equipoQueAtaca === 'home' ? awaySquad : homeSquad;
  const nombreAtacante = nombreDeEquipo(equipoQueAtaca, homeSquad, awaySquad);

  if (tipo === 'save') {
    // En una atajada, el protagonista es el arquero del equipo que defiende,
    // así que el evento queda "asignado" a ese equipo.
    const equipoQueDefiende = equipoQueAtaca === 'home' ? 'away' : 'home';
    const arquero = obtenerArquero(equipoDefensor);
    const nombreArquero = arquero ? arquero.name : 'El arquero';
    return {
      minute: minuto,
      type: 'save',
      team: equipoQueDefiende,
      playerName: nombreArquero,
      text: `¡Gran atajada de ${nombreArquero} (${nombreDeEquipo(equipoQueDefiende, homeSquad, awaySquad)})!`,
    };
  }

  // Para goal / post / miss, el protagonista es un atacante del equipo que ataca.
  const atacante = elegirAlAzar(obtenerAtacantes(equipoAtacante));
  const nombreJugador = atacante ? atacante.name : 'Un jugador';

  if (tipo === 'goal') {
    return {
      minute: minuto,
      type: 'goal',
      team: equipoQueAtaca,
      playerName: nombreJugador,
      text: `¡GOOOL de ${nombreJugador} (${nombreAtacante})!`,
    };
  }

  if (tipo === 'post') {
    return {
      minute: minuto,
      type: 'post',
      team: equipoQueAtaca,
      playerName: nombreJugador,
      text: `${nombreJugador} estrella el remate en el palo.`,
    };
  }

  // tipo === 'miss'
  return {
    minute: minuto,
    type: 'miss',
    team: equipoQueAtaca,
    playerName: nombreJugador,
    text: `${nombreJugador} desperdicia una ocasión clara.`,
  };
}

// -----------------------------------------------------------------------
// PASO 6: estado mutable del partido (tácticas, formaciones y cambios)
// -----------------------------------------------------------------------

// crearMatchState arma el objeto que representa "lo que se puede tocar" de
// cada equipo mientras el partido está en curso: qué táctica y qué
// formación tiene activa cada uno, y cuántas sustituciones le quedan. Este
// objeto se le entrega a quien use el motor (a través del callback
// onMatchReady) para que, por ejemplo, una escena de Phaser pueda cambiar la
// formación o hacer un cambio en medio del partido, y que el próximo tramo
// que se simule ya tenga en cuenta esos cambios.
function crearMatchState(homeSquad, awaySquad) {
  // Si el equipo no trae un banco de suplentes, le ponemos uno vacío para
  // no explotar al buscar jugadores ahí.
  if (!homeSquad.bench) homeSquad.bench = [];
  if (!awaySquad.bench) awaySquad.bench = [];

  const squads = { home: homeSquad, away: awaySquad };
  const tacticas = { home: 'orden', away: 'orden' };
  const formaciones = { home: '4-4-2', away: '4-4-2' };
  const cambiosRestantes = { home: 3, away: 3 };

  return {
    getTactic(equipo) {
      return tacticas[equipo];
    },
    getFormation(equipo) {
      return formaciones[equipo];
    },
    getCambiosRestantes(equipo) {
      return cambiosRestantes[equipo];
    },

    // setTactic la usa el propio motor cuando el jugador elige una opción en
    // el panel de decisión (ver simulateMatch más abajo). La táctica elegida
    // queda activa y PERSISTE en los tramos siguientes hasta que se vuelva a
    // cambiar: no es un efecto de un solo tramo.
    setTactic(equipo, clave) {
      if (!TACTICS[clave]) return { ok: false, reason: 'táctica inválida' };
      tacticas[equipo] = clave;
      return { ok: true };
    },

    // setFormation la llama la UI (por ejemplo, el panel "Formación" de
    // MatchScene) para cambiar la formación de un equipo en cualquier
    // momento del partido.
    setFormation(equipo, clave) {
      if (!FORMATIONS[clave]) return { ok: false, reason: 'formación inválida' };
      formaciones[equipo] = clave;
      return { ok: true };
    },

    // substitutePlayer saca a jugadorSaleId del 11 titular y pone en su
    // lugar a jugadorEntraId (que tiene que estar en el banco). Devuelve
    // { ok: true } si pudo hacer el cambio, o { ok: false, reason } si no
    // (ya sea porque no quedan cambios o porque no encontró a alguno de los
    // dos jugadores).
    substitutePlayer(equipo, jugadorSaleId, jugadorEntraId) {
      if (cambiosRestantes[equipo] <= 0) {
        return { ok: false, reason: 'sin cambios' };
      }

      const squad = squads[equipo];
      const indiceEnCancha = squad.players.findIndex((jugador) => jugador.id === jugadorSaleId);
      const indiceEnBanco = squad.bench.findIndex((jugador) => jugador.id === jugadorEntraId);

      if (indiceEnCancha === -1 || indiceEnBanco === -1) {
        return { ok: false, reason: 'jugador no encontrado' };
      }

      // Intercambiamos las posiciones: el que entra pasa a "players", el que
      // sale pasa al banco. Como attackPower/defensePower leen team.players
      // de nuevo en cada tramo, el cambio queda reflejado automáticamente en
      // las stats del equipo sin tener que recalcular nada más acá.
      const jugadorQueSale = squad.players[indiceEnCancha];
      const jugadorQueEntra = squad.bench[indiceEnBanco];
      squad.players[indiceEnCancha] = jugadorQueEntra;
      squad.bench[indiceEnBanco] = jugadorQueSale;

      cambiosRestantes[equipo] -= 1;
      return { ok: true };
    },
  };
}

// -----------------------------------------------------------------------
// FUNCIÓN PRINCIPAL: simulateMatch
// -----------------------------------------------------------------------

// simulateMatch simula el partido completo entre homeSquad (el equipo del
// jugador) y awaySquad (el rival). Cada squad es { name, players: [...11
// titulares], bench: [...suplentes] }.
//
// callbacks es un objeto OPCIONAL con hasta cuatro funciones:
//   - onMatchReady(matchState): se llama UNA vez, apenas arranca la
//     simulación, y le entrega el estado del partido (matchState) para que
//     quien use el motor pueda ir consultándolo/tocándolo durante el
//     partido (cambiar formación, hacer un cambio, etc).
//   - onEvent(event): se llama por cada evento que va pasando (gol, palo,
//     atajada, tiro afuera, arranque, entretiempo, final). Puede devolver una
//     promesa (por ejemplo, para esperar una animación): el motor la espera
//     con "await" antes de seguir generando el resto del partido.
//   - onDecision(decision): se llama en los dos puntos de decisión táctica
//     (minuto 30 y minuto 60). Tiene que devolver (puede ser una promesa) el
//     id (clave de TACTICS) de la opción elegida por el jugador.
//   - onBlockStart(block): opcional, avisa cuándo arranca cada uno de los 4
//     tramos del partido, antes de simular sus eventos.
//
// Si alguno de estos callbacks no viene, el motor sigue de largo sin
// problema (por eso siempre se llaman con "?.", el operador de "encadenado
// opcional" de JavaScript: si callbacks.onEvent no existe, no explota, solo
// no hace nada).
export async function simulateMatch(homeSquad, awaySquad, callbacks = {}) {
  const eventos = [];
  const decisiones = [];

  const matchState = crearMatchState(homeSquad, awaySquad);
  callbacks.onMatchReady?.(matchState);

  // registrarEvento agrega el evento a la lista final Y avisa por el
  // callback onEvent, esperando (await) lo que ese callback devuelva.
  async function registrarEvento(evento) {
    eventos.push(evento);
    await callbacks.onEvent?.(evento);
  }

  // Arranca el partido: evento de kickoff en el minuto 0.
  await registrarEvento({ minute: 0, type: 'kickoff', team: null, playerName: null, text: '¡Arranca el partido!' });

  for (let i = 0; i < TRAMOS.length; i++) {
    const [inicio, fin] = TRAMOS[i];

    await callbacks.onBlockStart?.({ index: i, startMinute: inicio, endMinute: fin });

    // Los puntos de decisión son antes del tramo 2 (índice 1, arranca en el
    // minuto 30) y antes del tramo 3 (índice 2, arranca en el minuto 60).
    const esPuntoDeDecision = i === 1 || i === 2;

    if (esPuntoDeDecision) {
      const marcadorActual = contarGoles(eventos);
      const clavesDeTactica = obtenerClavesDeTacticasParaMarcador(marcadorActual);

      const decision = {
        minute: inicio,
        situation: describirSituacion(marcadorActual),
        options: clavesDeTactica.map((clave) => ({ id: clave, label: TACTICS[clave].label })),
      };

      const idElegido = await callbacks.onDecision?.(decision);
      const claveElegida = TACTICS[idElegido] ? idElegido : 'orden';

      // La táctica elegida queda activa para el equipo local y persiste en
      // los tramos siguientes (ver setTactic en crearMatchState).
      matchState.setTactic('home', claveElegida);

      decisiones.push({
        minute: inicio,
        situation: decision.situation,
        marcador: marcadorActual,
        options: decision.options,
        elegida: claveElegida,
      });
    }

    // Armamos todos los eventos de este tramo (de los dos equipos) en una
    // lista aparte, para poder ordenarlos por minuto antes de emitirlos.
    const eventosDelTramo = [];

    // A minuto 45 (mitad del partido) insertamos el evento de entretiempo.
    // Como el tramo 30-60 (índice 1) contiene ese minuto, lo agregamos ahí.
    if (i === 1) {
      eventosDelTramo.push({ minute: 45, type: 'halftime', team: null, playerName: null, text: 'Fin del primer tiempo.' });
    }

    // Leemos la formación y la táctica activa de cada equipo recién ahora,
    // al empezar este tramo, para que un cambio hecho durante el tramo
    // anterior (formación nueva, sustitución) ya se sienta en este.
    const formacionHome = matchState.getFormation('home');
    const formacionAway = matchState.getFormation('away');
    const tacticaHome = TACTICS[matchState.getTactic('home')];
    const tacticaAway = TACTICS[matchState.getTactic('away')];

    const ocasionesExtraPorEquipo = repartirOcasionesExtra(homeSquad, awaySquad, tacticaHome, tacticaAway);

    // Por cada equipo, tiramos el "dado" del tiro importante (el que decide
    // si hay gol) y además algunas ocasiones extra sin gol, para variar el relato.
    for (const [equipoId, equipoPropio, equipoRival, formacionPropia, tacticaPropia, formacionRival, tacticaRival] of [
      ['home', homeSquad, awaySquad, formacionHome, tacticaHome, formacionAway, tacticaAway],
      ['away', awaySquad, homeSquad, formacionAway, tacticaAway, formacionHome, tacticaHome],
    ]) {
      const atkTotal = calcularAtkTotal(equipoPropio, formacionPropia, tacticaPropia);
      const defTotalRival = calcularDefTotal(equipoRival, formacionRival, tacticaRival);

      const probabilidadGol = calcularProbabilidadGol(atkTotal, defTotalRival);
      if (Math.random() < probabilidadGol) {
        eventosDelTramo.push(crearEventoDeTiro('goal', randomMinuto(inicio, fin), equipoId, homeSquad, awaySquad));
      }

      // La cantidad de ocasiones extra que le tocan a este equipo sale del
      // reparto de arriba, ajustada por el occasionMod de su táctica activa
      // (por ejemplo, bloqueBajo genera menos ocasiones porque el equipo
      // juega replegado).
      const modificadorDeOcasiones = tacticaPropia.occasionMod ?? 1;
      const cantidadDeOcasionesExtra = Math.max(
        0,
        Math.round(ocasionesExtraPorEquipo[equipoId] * modificadorDeOcasiones)
      );

      for (let j = 0; j < cantidadDeOcasionesExtra; j++) {
        const tipo = elegirTipoDeOcasionSinGol();
        eventosDelTramo.push(crearEventoDeTiro(tipo, randomMinuto(inicio, fin), equipoId, homeSquad, awaySquad));
      }
    }

    // Ordenamos los eventos del tramo por minuto para que el relato salga
    // en orden cronológico, y los vamos emitiendo uno por uno con await.
    eventosDelTramo.sort((a, b) => a.minute - b.minute);
    for (const evento of eventosDelTramo) {
      await registrarEvento(evento);
    }
  }

  // Cierra el partido: evento de fulltime en el minuto 90.
  await registrarEvento({ minute: 90, type: 'fulltime', team: null, playerName: null, text: 'Termina el partido.' });

  const marcadorFinal = contarGoles(eventos);

  return {
    eventos,
    decisiones,
    marcadorFinal,
  };
}
