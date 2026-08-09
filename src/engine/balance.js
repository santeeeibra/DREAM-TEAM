// PURA. Único lugar donde viven los números de balance.
// Versionado: si cambiás algo acá, subí BALANCE_VERSION y volvé a correr el harness.
export const BALANCE_VERSION = '1.1.0';

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
  PRESION_POR_RENDIMIENTO: 5,
  PRESION_OBJETIVO_LEJOS: 2,
  PRESION_OBJETIVO_CERCA: -4,
};

export const TEMPORADA = {
  PREMIO_BASE: 0.9,          // (21 - posicion) * base
  DESCANSO_FATIGA: -35,
  OBJETIVO_INICIAL: 12,      // terminar 12° o mejor en la temporada 1
  OBJETIVO_APRIETE: 2,       // cada temporada el club pide 2 puestos más arriba
  OBJETIVO_PISO: 2,          // el club nunca exige menos que subcampeón
  PRESION_OBJETIVO_FALLADO: 18,
  PRESION_OBJETIVO_CUMPLIDO: -15,
  MORAL_TITULO: 10,
  PRESION_EXPECTATIVA_POR_TEMPORADA: 1.5,
};

export const DESPIDO = { PRESION: 100 };

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
