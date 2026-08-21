// PURA. Único lugar donde viven los números de balance.
// Versionado: si cambiás algo acá, subí BALANCE_VERSION y volvé a correr el harness.
export const BALANCE_VERSION = '1.8.0';

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
  // DFC es exclusivo de DEF (igual que ARQ de POR): ahí un MED/DEL cae directo a FUERA.
  PENALIDAD_POSICION: { NATURAL: 0, VECINO: 5, FUERA: 25 },
  // Si el slot ARQ no está cubierto por un POR real, el equipo concede el doble.
  // Es un castigo aparte de la penalidad de rating: aunque metas un DEL de arquero
  // (ya penalizado −25), los goles en contra se multiplican por este factor.
  SIN_ARQUERO_MULT_GC: 2.5,
  LOCALIA: 1.12,
  VISITA: 0.92,
  GOLES_BASE: 1.35,
  GOLES_ESCALA: 18,               // sensibilidad al diferencial de fuerza
  GOLES_ESCALA_INFERIOR: 12,      // el inferior cae mas abrupto: menos milagros contra los grandes
};

// Deriva pasiva por tramo (sin feedback multiplicativo: evita el "pozo gravitacional" de moral)
export const TRAMO = {
  FATIGA_POR_TRAMO: 4,   // base por tramo; la hazana contra grandes cobra aparte (FATIGA_HAZANA)
  FATIGA_HAZANA: 3,      // impuesto fisico por partido con puntos contra un tier alto (off > 0)
  MORAL_DRIFT_A_50: 2,     // tira 1 punto hacia 50, aditivo
  INGRESO_NETO: 1,         // sponsors - sueldos
  MORAL_POR_RENDIMIENTO: 6,  // ±, escalado por (ppp - 1.35)
  PRESION_POR_RENDIMIENTO: 7,  // +2: que los malos resultados duelan más
  PRESION_OBJETIVO_LEJOS: 6,   // +2: la presión por objetivo crece más rápido
  PRESION_OBJETIVO_CERCA: -4,
  PRESION_BRECHA: 3,  // +3 presión por cada puesto de distancia al objetivo (brecha positiva = atrás del objetivo)
};

export const TEMPORADA = {
  PREMIO_BASE: 0.9,          // (21 - posicion) * base
  DESCANSO_FATIGA: -42,
  OBJETIVO_INICIAL: 12,      // terminar 12° o mejor en la temporada 1
  OBJETIVO_APRIETE: 2,       // cada temporada el club pide 2 puestos más arriba
  OBJETIVO_PISO: 2,          // el club nunca exige menos que subcampeón
  PRESION_OBJETIVO_FALLADO: 32,   // +10: fallar el objetivo es un golpe serio
  PRESION_OBJETIVO_CUMPLIDO: -15,
  MORAL_TITULO: 10,
  PRESION_EXPECTATIVA_POR_TEMPORADA: 2.0,
};

export const DESPIDO = { PRESION: 80 };

export const ROTACION_PLANTEL = {
  PROB_OFERTA_JUGADOR_GRANDE: 0.60,  // OVR >= 82 + edad >= 28 → 60% de recibir oferta
  PROB_OFERTA_JUGADOR_MEDIO:  0.25,  // OVR 74-81 → 25%
  MAX_SALIDAS_POR_TEMPORADA:  2,
  MONEY_VENTA_BASE:           8,     // dinero base que entra al vender
  MONEY_VENTA_POR_OVR:        0.3,   // extra por cada punto de OVR sobre 74
};

// Rarezas de cartas. Los rangos de rating son el shape REAL (no hay mocks paralelos).
// La liga se refuerza a medida que avanzás: sin esto, la carrera se vuelve un paseo.
export const ESCALADA_LIGA = {
  BASE: 66,
  POR_TEMPORADA: 1.2,
  CASTIGO_AL_LIDER: 2.0,   // si terminaste top 5, los rivales suben más
  ALIVIO_AL_ULTIMO: -1.0,  // si peleaste el descenso, la liga te da aire
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
  JOVEN: 24, VETERANO: 31, RETIRO: 39,
  SUBIDA: [1, 3], BAJADA: [1, 3], MESETA: [-1, 1],
};

// ─── SISTEMA DE DIFICULTAD ──────────────────────────────────────────────────
// Modo fácil: valores actuales sin cambios.
// Modo difícil: presión asimétrica, épicas obligatorias para competir por el título.

export const MODO = { FACIL: 'facil', DIFICIL: 'dificil' };

export const MODO_JUEGO = {
  LIGA:      'liga',
  GLOBAL:    'global',
  BUDGET:    'budget',
  DRAFT:     'draft',
  PAIS:      'pais',
  CLUB_REAL: 'club_real',
};

// Modo Budget: arrancás con poca plata — cada decisión económica duele.
export const BUDGET = { MONEY_INICIAL: 4 };

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
// Clave: `club_id` de leagues.js (los 60 clubes de las 3 ligas con cartas).
// Clubs grandes: ya arrancás con presión de la hinchada y la directiva.
// Clubs chicos: arrancan más tranquilos, pero sin margen de error.
export const PRESION_INICIAL_TIER = {
  // Premier League — Big 6
  'man-city': 42, 'arsenal': 36, 'liverpool': 40,
  'chelsea': 32, 'man-utd': 30, 'tottenham': 28,
  // Premier — medianos
  'aston-villa': 25, 'newcastle': 24, 'brighton': 20, 'crystal-palace': 18,
  'fulham': 18, 'brentford': 18, 'everton': 18, 'leeds': 18, 'nottingham-forest': 18,
  'bournemouth': 16,
  // LaLiga — tops
  'real-madrid': 42, 'barcelona': 40, 'atletico-madrid': 34,
  'sevilla': 25, 'valencia': 22, 'villarreal': 22, 'athletic': 22,
  'real-sociedad': 20, 'real-betis': 18, 'girona': 16, 'celta-vigo': 16,
  // Serie A
  'juventus': 38, 'inter': 38, 'milan': 36, 'napoli': 32,
  'roma': 26, 'atalanta': 22, 'lazio': 20, 'fiorentina': 18, 'bologna': 16,
};
// Clubs no listados (chicos): menor presión inicial pero techo de título muy bajo
export const PRESION_INICIAL_DIFICIL_DEFAULT = 15;

// Estilos de juego por club. Clave: `club_id` de leagues.js.
// Afectan el multiplicador de goles en la simulación (liga.js).
// goles_mod: cuánto cambia la producción ofensiva del RIVAL al enfrentarlos
// concedidos_mod: cuánto cambia lo que te meten a vos
// presion_extra: presión adicional que suma al estado del DT si perdés contra ellos
export const ESTILOS_CLUB = {
  // Premier League — Top 6
  'man-city':       { goles_mod: +0.20, concedidos_mod: +0.18, presion_extra: 4 },
  'arsenal':        { goles_mod: +0.15, concedidos_mod: +0.14, presion_extra: 3 },
  'liverpool':      { goles_mod: +0.18, concedidos_mod: +0.16, presion_extra: 3 },
  'chelsea':        { goles_mod: +0.12, concedidos_mod: +0.10, presion_extra: 2 },
  'man-utd':        { goles_mod: +0.10, concedidos_mod: +0.08, presion_extra: 2 },
  'tottenham':      { goles_mod: +0.12, concedidos_mod: +0.14, presion_extra: 2 },
  // Premier — media tabla (neutrales)
  'aston-villa':    { goles_mod: +0.05, concedidos_mod: +0.05, presion_extra: 1 },
  'newcastle':      { goles_mod: +0.06, concedidos_mod: +0.06, presion_extra: 1 },
  'brighton':       { goles_mod: +0.06, concedidos_mod: +0.04, presion_extra: 1 },
  'crystal-palace': { goles_mod: +0.02, concedidos_mod: +0.08, presion_extra: 1 },
  'fulham':         { goles_mod: +0.04, concedidos_mod: +0.10, presion_extra: 1 },
  'bournemouth':    { goles_mod: +0.04, concedidos_mod: +0.10, presion_extra: 1 },
  'brentford':      { goles_mod: +0.04, concedidos_mod: +0.10, presion_extra: 1 },
  // Premier — defensivos / candidatos al descenso
  'nottingham-forest': { goles_mod: -0.10, concedidos_mod: +0.12, presion_extra: 0 },
  'everton':        { goles_mod: -0.10, concedidos_mod: +0.14, presion_extra: 0 },
  'leeds':          { goles_mod: -0.12, concedidos_mod: +0.14, presion_extra: 0 },
  'sunderland':     { goles_mod: -0.12, concedidos_mod: +0.15, presion_extra: 0 },
  'hull':           { goles_mod: -0.12, concedidos_mod: +0.15, presion_extra: 0 },
  'coventry':       { goles_mod: -0.10, concedidos_mod: +0.12, presion_extra: 0 },
  'ipswich':        { goles_mod: -0.12, concedidos_mod: +0.14, presion_extra: 0 },
  // LaLiga — tops
  'real-madrid':    { goles_mod: +0.18, concedidos_mod: +0.16, presion_extra: 4 },
  'barcelona':      { goles_mod: +0.17, concedidos_mod: +0.15, presion_extra: 4 },
  'atletico-madrid':{ goles_mod: +0.10, concedidos_mod: +0.12, presion_extra: 3 },
  'sevilla':        { goles_mod: +0.06, concedidos_mod: +0.10, presion_extra: 2 },
  'valencia':       { goles_mod: +0.04, concedidos_mod: +0.08, presion_extra: 1 },
  'villarreal':     { goles_mod: +0.06, concedidos_mod: +0.08, presion_extra: 1 },
  'athletic':       { goles_mod: +0.06, concedidos_mod: +0.06, presion_extra: 1 },
  'real-sociedad':  { goles_mod: +0.05, concedidos_mod: +0.05, presion_extra: 1 },
  'real-betis':     { goles_mod: +0.04, concedidos_mod: +0.08, presion_extra: 1 },
  'girona':         { goles_mod: +0.04, concedidos_mod: +0.10, presion_extra: 1 },
  'celta-vigo':     { goles_mod: +0.02, concedidos_mod: +0.08, presion_extra: 1 },
  // LaLiga — defensivos / candidatos al descenso
  'getafe':         { goles_mod: -0.06, concedidos_mod: +0.06, presion_extra: 0 },
  'osasuna':        { goles_mod: +0.02, concedidos_mod: +0.04, presion_extra: 0 },
  'rayo-vallecano': { goles_mod: +0.02, concedidos_mod: +0.10, presion_extra: 0 },
  'mallorca':       { goles_mod: -0.04, concedidos_mod: +0.08, presion_extra: 0 },
  'espanyol':       { goles_mod: -0.10, concedidos_mod: +0.14, presion_extra: 0 },
  'alaves':         { goles_mod: -0.08, concedidos_mod: +0.10, presion_extra: 0 },
  'elche':          { goles_mod: -0.12, concedidos_mod: +0.15, presion_extra: 0 },
  'levante':        { goles_mod: -0.12, concedidos_mod: +0.15, presion_extra: 0 },
  'real-oviedo':    { goles_mod: -0.10, concedidos_mod: +0.12, presion_extra: 0 },
  // Serie A — tops
  'juventus':       { goles_mod: +0.12, concedidos_mod: +0.10, presion_extra: 3 },
  'inter':          { goles_mod: +0.14, concedidos_mod: +0.10, presion_extra: 3 },
  'milan':          { goles_mod: +0.12, concedidos_mod: +0.10, presion_extra: 3 },
  'napoli':         { goles_mod: +0.12, concedidos_mod: +0.12, presion_extra: 3 },
  'roma':           { goles_mod: +0.08, concedidos_mod: +0.08, presion_extra: 2 },
  'atalanta':       { goles_mod: +0.10, concedidos_mod: +0.10, presion_extra: 2 },
  'lazio':          { goles_mod: +0.06, concedidos_mod: +0.08, presion_extra: 2 },
  'fiorentina':     { goles_mod: +0.06, concedidos_mod: +0.06, presion_extra: 1 },
  'bologna':        { goles_mod: +0.04, concedidos_mod: +0.06, presion_extra: 1 },
  'torino':         { goles_mod: +0.02, concedidos_mod: +0.04, presion_extra: 1 },
  'sassuolo':       { goles_mod: +0.02, concedidos_mod: +0.08, presion_extra: 1 },
  'udinese':        { goles_mod: +0.02, concedidos_mod: +0.08, presion_extra: 1 },
  // Serie A — defensivos / candidatos al descenso
  'genoa':          { goles_mod: -0.04, concedidos_mod: +0.08, presion_extra: 0 },
  'cagliari':       { goles_mod: -0.06, concedidos_mod: +0.10, presion_extra: 0 },
  'como':           { goles_mod: -0.04, concedidos_mod: +0.08, presion_extra: 0 },
  'cremonese':      { goles_mod: -0.10, concedidos_mod: +0.12, presion_extra: 0 },
  'hellas-verona':  { goles_mod: -0.08, concedidos_mod: +0.10, presion_extra: 0 },
  'lecce':          { goles_mod: -0.06, concedidos_mod: +0.08, presion_extra: 0 },
  'parma':          { goles_mod: -0.08, concedidos_mod: +0.10, presion_extra: 0 },
  'pisa':           { goles_mod: -0.12, concedidos_mod: +0.14, presion_extra: 0 },
  // Default implícito (si el club no aparece acá): { goles_mod: 0, concedidos_mod: 0, presion_extra: 1 }
};

// Jerarquía de poder real por club. Clave: `club_id` de leagues.js (los 19
// rivales de cada liga salen de esa lista y traen su id).
// grande = pelea el título, medio = pelea la mitad de la tabla, bajo = candidato al descenso.
// Si un club no aparece acá (p. ej. un club sin liga, caso legacy) cae a TIER_LIGA_DEFAULT.
export const TIER_LIGA = {
  // Premier League — Top 6
  'man-city': 'grande', 'arsenal': 'grande', 'liverpool': 'grande',
  'chelsea': 'grande', 'man-utd': 'grande', 'tottenham': 'grande',
  // Premier — media tabla
  'aston-villa': 'medio', 'newcastle': 'medio', 'brighton': 'medio',
  'crystal-palace': 'medio', 'everton': 'medio', 'fulham': 'medio',
  'bournemouth': 'medio', 'leeds': 'medio', 'nottingham-forest': 'medio',
  'brentford': 'medio',
  // Premier — candidatos al descenso
  'coventry': 'bajo', 'hull': 'bajo', 'ipswich': 'bajo', 'sunderland': 'bajo',
  // LaLiga — tops
  'real-madrid': 'grande', 'barcelona': 'grande', 'atletico-madrid': 'grande',
  // LaLiga — media tabla
  'sevilla': 'medio', 'valencia': 'medio', 'villarreal': 'medio',
  'athletic': 'medio', 'real-sociedad': 'medio', 'real-betis': 'medio',
  'girona': 'medio', 'celta-vigo': 'medio', 'getafe': 'medio', 'osasuna': 'medio',
  'rayo-vallecano': 'medio', 'mallorca': 'medio',
  // LaLiga — candidatos al descenso
  'espanyol': 'bajo', 'alaves': 'bajo', 'elche': 'bajo', 'levante': 'bajo',
  'real-oviedo': 'bajo',
  // Serie A — tops
  'juventus': 'grande', 'inter': 'grande', 'milan': 'grande', 'napoli': 'grande',
  // Serie A — media tabla
  'roma': 'medio', 'atalanta': 'medio', 'lazio': 'medio', 'fiorentina': 'medio',
  'bologna': 'medio', 'torino': 'medio', 'sassuolo': 'medio', 'udinese': 'medio',
  // Serie A — candidatos al descenso
  'genoa': 'bajo', 'cagliari': 'bajo', 'como': 'bajo', 'cremonese': 'bajo',
  'hellas-verona': 'bajo', 'lecce': 'bajo', 'parma': 'bajo', 'pisa': 'bajo',
};
export const TIER_LIGA_DEFAULT = 'medio';

// Cap de OVR para el pool de cartas en modo Global según la liga del DT.
// Evita que en ligas chicas el DT reciba épicas (85-99) que rompen el balance.
export const OVR_CAP_POR_LIGA = {
  premier:    99,
  laliga:     99,
  seriea:     99,
  bundesliga: 99,
  ligue1:     82,
  ligapro:    78,
  mls:        78,
};
export const OVR_CAP_DEFAULT = 78;

// Boost pasivo a rivales en modo Global cuando el plantel del DT supera al OVR
// promedio de la liga. Evita que el DT domine ligas cuyos rivales promedian 66-70.
export const BOOST_RIVAL_GLOBAL = {
  UMBRAL_DELTA: 6,  // diferencia mínima para activar el boost
  FACTOR:       0.4, // puntos de fuerza por cada punto de diferencia sobre el umbral
  MAX_BOOST:    5,   // techo de boost
};

// Banda de fuerza por tier: desvío sobre la media de ESCALADA_LIGA.
// ±7 con sd 2 deja las bandas SEPARADAS (sin solape realista): un club medio o
// bajo no puede generar fuerza de campeonato en un full season (medido: 0-0.5%
// de temporadas ganadas por un medio, 0% por un bajo) y un grande nunca cae
// tan bajo como para pelear el descenso. Antes todos los rivales sacaban de la
// misma gauss(media, 5.5) y clubs de mitad/baja tabla ganaban la liga ~68% de
// las sims.
export const FUERZA_POR_TIER = {
  grande: { off: +7, sd: 2 },
  medio:  { off: 0, sd: 2 },
  bajo:   { off: -7, sd: 2 },
};
