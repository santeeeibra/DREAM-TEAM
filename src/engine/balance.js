// PURA. Único lugar donde viven los números de balance.
// Versionado: si cambiás algo acá, subí BALANCE_VERSION y volvé a correr el harness.
export const BALANCE_VERSION = '1.2.0';

export const LIGA = {
  EQUIPOS: 20,
  FECHAS: 38,
  // 6 tramos = 6 puntos de decisión por temporada. Suma 38.
  TRAMOS: [7, 7, 6, 6, 6, 6],
};

export const CARRERA = {
  TEMPORADAS: 8,
  PLANTEL_MAX: 18,
  TITULARES: 11,
};

// Rangos duros. TODO valor de estado se clampea acá y en ningún otro lado.
export const RANGOS = {
  money: [0, 999],
  moral: [0, 100],
  fatiga: [0, 100],
  presion: [0, 100],
  ratingDelta: [-8, 8], // modificador de temporada, se resetea al cerrarla
};

export const ESTADO_INICIAL = {
  money: 12,
  moral: 60,
  fatiga: 10,
  presion: 25,
  ratingDelta: 0,
};

// Fuerza de partido = rating del 11 + estos ajustes.
export const FUERZA = {
  PESO_MORAL: 0.06,      // (moral-50) * peso  -> ±3
  PESO_FATIGA: 0.05,     // -fatiga * peso     -> 0..-5
  PESO_PRESION: 0.02,    // -presion * peso    -> 0..-2
  PESO_MOMENTUM: 0.5,    // momentum ∈ [-3,3]  -> ±1.5
  // Penalización de rating por jugador fuera de su puesto natural, graduada por cercanía
  // de línea. Ver data/posiciones.js:penalidad() para el criterio de qué es "vecino".
  PENALIDAD_POSICION: { NATURAL: 0, VECINO: 2, FUERA: 6 },
  LOCALIA: 1.12,
  VISITA: 0.92,
  GOLES_BASE: 1.35,
  GOLES_ESCALA: 18,      // sensibilidad al diferencial de fuerza
};

// Deriva pasiva por tramo (sin feedback multiplicativo: evita el "pozo gravitacional" de moral)
export const TRAMO = {
  FATIGA_POR_TRAMO: 7,
  MORAL_DRIFT_A_50: 2,     // tira 1 punto hacia 50, aditivo
  INGRESO_NETO: 1,         // sponsors - sueldos
  MORAL_POR_RENDIMIENTO: 6,  // ±, escalado por (ppp - 1.35)
  PRESION_POR_RENDIMIENTO: 7,  // +2: que los malos resultados duelan más
  PRESION_OBJETIVO_LEJOS: 6,   // +2: la presión por objetivo crece más rápido
  PRESION_OBJETIVO_CERCA: -4,
};

export const TEMPORADA = {
  PREMIO_BASE: 0.9,          // (21 - posicion) * base
  DESCANSO_FATIGA: -35,
  OBJETIVO_INICIAL: 12,      // terminar 12° o mejor en la temporada 1
  OBJETIVO_APRIETE: 2,       // cada temporada el club pide 2 puestos más arriba
  OBJETIVO_PISO: 2,          // el club nunca exige menos que subcampeón
  PRESION_OBJETIVO_FALLADO: 32,   // +10: fallar el objetivo es un golpe serio
  PRESION_OBJETIVO_CUMPLIDO: -15,
  MORAL_TITULO: 10,
  PRESION_EXPECTATIVA_POR_TEMPORADA: 2.0,
};

export const DESPIDO = { PRESION: 80 };

// Rarezas de cartas. Los rangos de rating son el shape REAL (no hay mocks paralelos).
// La liga se refuerza a medida que avanzás: sin esto, la carrera se vuelve un paseo.
export const ESCALADA_LIGA = {
  BASE: 66,
  POR_TEMPORADA: 1.2,
  CASTIGO_AL_LIDER: 2.0,   // si terminaste top 5, los rivales suben más
  ALIVIO_AL_ULTIMO: -1.0,  // si peleaste el descenso, la liga te da aire
  SD: 5.5,
};

export const RAREZAS = {
  bronce:    { rating: [45, 73], peso: 15, color: '#9C6B3F' },
  oro_comun: { rating: [74, 79], peso: 35, color: '#A9B3BC' },
  oro_unico: { rating: [80, 84], peso: 35, color: '#E0B34C' },
  epica:     { rating: [85, 99], peso: 15, color: '#FF5E1A' },
};

export const SOBRES = {
  INICIAL: { cartas: 5, cantidad: 3, bonus: 1 },
  // El sobre de refuerzo entre temporadas: mejor posición final = mejor sobre.
  REFUERZO: { cartas: 3, bonusPorPosicion: (pos) => (pos <= 1 ? 3 : pos <= 4 ? 2 : pos <= 10 ? 1 : 0) },
};

export const PROGRESION = {
  JOVEN: 24, VETERANO: 31,
  SUBIDA: [1, 3], BAJADA: [1, 3], MESETA: [-1, 1],
};

// ─── SISTEMA DE DIFICULTAD ──────────────────────────────────────────────────
// Modo fácil: valores actuales sin cambios.
// Modo difícil: presión asimétrica, épicas obligatorias para competir por el título.

export const MODO = { FACIL: 'facil', DIFICIL: 'dificil' };

// En modo difícil, los efectos de presión de cada evento se reemplazan por:
// - Si el efecto sube presión: siempre +25 (crítico)
// - Si el efecto baja presión: siempre -10 (alivio limitado)
// - Si el evento no tenía presión: se deduce del net de moral/ratingDelta
export const PRESION_DIFICIL = { SUBE: 25, BAJA: -10 };

// Modificador de fuerza por épicas en el 11 (solo modo difícil).
// Sin épicas, el equipo no puede alcanzar su techo real.
export const EPICAS_DIFICIL = {
  SIN_EPICAS_MOD: -5,        // fuerza que se resta si no hay ninguna épica en el XI
  CON_EPICA_BONUS: 2,        // puntos de fuerza por cada épica (hasta MAX_EPICAS)
  MAX_EPICAS: 3,
};

// Probabilidad de que un evento grave reemplace al evento narrativo normal.
// Solo aplica en modo difícil (0 en modo fácil).
export const DIFICULTAD = { PROB_GRAVE_POR_TRAMO: 0.30 };

// Presión inicial del DT según el club elegido (solo modo difícil).
// Clubs grandes: ya arrancás con presión de la hinchada y la directiva.
// Clubs chicos: arrancan más tranquilos, pero sin margen de error.
export const PRESION_INICIAL_TIER = {
  // Premier League — Big 6
  'Manchester City': 42, 'Arsenal': 36, 'Liverpool': 40,
  'Chelsea': 32, 'Manchester United': 30, 'Tottenham': 28,
  // Medianos
  'Aston Villa': 25, 'Newcastle': 24, 'Brighton': 20, 'West Ham': 20,
  // LaLiga — tops
  'Real Madrid': 42, 'Barcelona': 40, 'Atlético Madrid': 34,
  'Sevilla': 25, 'Valencia': 22, 'Villarreal': 22,
  // Bundesliga
  'Bayern Munich': 42, 'Borussia Dortmund': 34, 'RB Leipzig': 28,
  // Serie A
  'Juventus': 38, 'Inter Milan': 38, 'AC Milan': 36, 'Napoli': 32,
};
// Clubs no listados (chicos): menor presión inicial pero techo de título muy bajo
export const PRESION_INICIAL_DIFICIL_DEFAULT = 15;

// Estilos de juego por club. Afectan el multiplicador de goles en la simulación (liga.js).
// goles_mod: cuánto cambia la producción ofensiva del RIVAL al enfrentarlos
// concedidos_mod: cuánto cambia lo que te meten a vos
// presion_extra: presión adicional que suma al estado del DT si perdés contra ellos
export const ESTILOS_CLUB = {
  // Premier League — Top 6
  'Manchester City':    { goles_mod: +0.20, concedidos_mod: +0.18, presion_extra: 4 },
  'Arsenal':            { goles_mod: +0.15, concedidos_mod: +0.14, presion_extra: 3 },
  'Liverpool':          { goles_mod: +0.18, concedidos_mod: +0.16, presion_extra: 3 },
  'Chelsea':            { goles_mod: +0.12, concedidos_mod: +0.10, presion_extra: 2 },
  'Manchester United':  { goles_mod: +0.10, concedidos_mod: +0.08, presion_extra: 2 },
  'Tottenham':          { goles_mod: +0.12, concedidos_mod: +0.14, presion_extra: 2 },
  // Equipos de media tabla — neutrales
  'Aston Villa':        { goles_mod: +0.05, concedidos_mod: +0.05, presion_extra: 1 },
  'Newcastle':          { goles_mod: +0.06, concedidos_mod: +0.06, presion_extra: 1 },
  'West Ham':           { goles_mod: +0.04, concedidos_mod: +0.08, presion_extra: 1 },
  'Brighton':           { goles_mod: +0.06, concedidos_mod: +0.04, presion_extra: 1 },
  // Equipos defensivos / candidatos al descenso
  'Burnley':            { goles_mod: -0.10, concedidos_mod: +0.12, presion_extra: 0 },
  'Sheffield United':   { goles_mod: -0.12, concedidos_mod: +0.14, presion_extra: 0 },
  'Luton Town':         { goles_mod: -0.10, concedidos_mod: +0.15, presion_extra: 0 },
  'Brentford':          { goles_mod: +0.04, concedidos_mod: +0.10, presion_extra: 1 },
  // Default implícito (si el club no aparece acá): { goles_mod: 0, concedidos_mod: 0, presion_extra: 1 }
};
