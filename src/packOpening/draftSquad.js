// draftSquad.js — arma el plantel inicial de 25 cartas (5 sobres x 5).
// Es lógica "pura": no toca Supabase ni Phaser, solo recibe un array de
// cartas disponibles y devuelve cuáles le tocaron al jugador. Así se puede
// leer y probar sin depender de la base de datos ni de la pantalla.

// Mínimos garantizados por posición. Suman 18 de las 25 cartas totales.
export const MINIMOS_POR_POSICION = {
  POR: 2,
  DEF: 6,
  MED: 6,
  DEL: 4,
};

export const TOTAL_CARTAS = 25;
export const CARTAS_POR_SOBRE = 5;
export const CANTIDAD_SOBRES = TOTAL_CARTAS / CARTAS_POR_SOBRE; // 5

// Fisher-Yates: mezcla un array de forma pareja (cada orden posible tiene
// la misma probabilidad). No modifica el array original, devuelve uno nuevo.
function mezclar(array) {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// pool: todas las cartas activas disponibles (mínimo necesitan `id` y
// `position`). Devuelve un array de 25 cartas sin repetidos.
//
// Cómo arma el plantel:
// 1. Separa el pool en 4 grupos por posición y mezcla cada grupo.
// 2. Toma los mínimos garantizados (2 POR, 6 DEF, 6 MED, 4 DEL = 18 cartas).
// 3. Las 7 cartas que faltan para llegar a 25 salen 100% al azar de TODO
//    el resto del pool, sin importar posición ni overall_rating. Por eso el
//    plantel final puede terminar siendo todo cracks o todo mediocre: la
//    calidad nunca se balancea a propósito.
export function draftSquad(pool) {
  const porPosicion = { POR: [], DEF: [], MED: [], DEL: [] };
  for (const carta of pool) {
    porPosicion[carta.position]?.push(carta);
  }

  const seleccionadas = [];
  const idsUsados = new Set();

  for (const [posicion, minimo] of Object.entries(MINIMOS_POR_POSICION)) {
    const disponibles = mezclar(porPosicion[posicion]);
    if (disponibles.length < minimo) {
      throw new Error(
        `No hay suficientes cartas activas en posición ${posicion}: hay ${disponibles.length}, hacen falta ${minimo}`
      );
    }
    for (let i = 0; i < minimo; i++) {
      seleccionadas.push(disponibles[i]);
      idsUsados.add(disponibles[i].id);
    }
  }

  const faltantes = TOTAL_CARTAS - seleccionadas.length;
  const poolRestante = mezclar(pool.filter((carta) => !idsUsados.has(carta.id)));

  if (poolRestante.length < faltantes) {
    throw new Error(
      `No hay suficientes cartas activas en el catálogo para completar el plantel de ${TOTAL_CARTAS}`
    );
  }

  for (let i = 0; i < faltantes; i++) {
    seleccionadas.push(poolRestante[i]);
  }

  // Mezclamos de nuevo el orden final: si no, siempre se abrirían primero
  // los arqueros/defensores (el orden en que los fuimos completando arriba).
  return mezclar(seleccionadas);
}

// Corta las 25 cartas en 5 sobres de 5 para la animación de apertura.
export function splitIntoPacks(cards, cardsPerPack = CARTAS_POR_SOBRE) {
  const sobres = [];
  for (let i = 0; i < cards.length; i += cardsPerPack) {
    sobres.push(cards.slice(i, i + cardsPerPack));
  }
  return sobres;
}
