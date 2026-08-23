// draftSquad.js — arma el plantel inicial de 15 cartas (3 sobres × 5).
// Es lógica "pura": no toca Supabase ni Phaser, solo recibe un array de
// cartas disponibles y devuelve cuáles le tocaron al jugador. Así se puede
// leer y probar sin depender de la base de datos ni de la pantalla.

import { getTier } from '../core/ratingTiers.js';

// Mínimos garantizados por posición. Suman 11 de las 15 cartas totales.
export const MINIMOS_POR_POSICION = {
  POR: 1,
  DEF: 4,
  MED: 3,
  DEL: 3,
};

export const TOTAL_CARTAS = 15;
export const CARTAS_POR_SOBRE = 5;
export const CANTIDAD_SOBRES = TOTAL_CARTAS / CARTAS_POR_SOBRE; // 3

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

// Pesos BASE ideales para cada banda de rareza.
const PESOS_BASE = { bronze: 15, silver: 15, gold: 45, special: 25 };
const TIERS = ['bronze', 'silver', 'gold', 'special'];

// Elige un tier ponderado, adaptado al pool real: si una banda tiene
// muy pocas cartas disponibles (≤ umbral), reduce su peso y lo reparte
// entre las bandas vecinas. Así en ligas chicas (ej. Argentina con solo
// 3 cartas gold) no se repiten siempre los mismos jugadores.
// Sin argumento se comporta igual que antes (pesos fijos).
export function pickWeightedTier(candidatas = null) {
  const pesos = { ...PESOS_BASE };

  if (candidatas && candidatas.length > 0) {
    const conteo = { bronze: 0, silver: 0, gold: 0, special: 0 };
    for (const c of candidatas) {
      const t = getTier(c.overall_rating).toLowerCase();
      if (conteo[t] !== undefined) conteo[t]++;
    }

    // Si un tier tiene ≤ UMBRAL cartas, reducir su peso proporcionalmente
    const UMBRAL = 4;
    let pesoSobrante = 0;
    let tiersConVariedad = 0;

    for (const t of TIERS) {
      if (conteo[t] === 0) {
        pesoSobrante += pesos[t];
        pesos[t] = 0;
      } else if (conteo[t] <= UMBRAL) {
        const pesoReal = Math.round(pesos[t] * conteo[t] / (UMBRAL + 1));
        pesoSobrante += pesos[t] - pesoReal;
        pesos[t] = pesoReal;
      } else {
        tiersConVariedad++;
      }
    }

    // Repartir el peso sobrante entre los tiers que tienen variedad
    if (pesoSobrante > 0 && tiersConVariedad > 0) {
      const bonus = Math.floor(pesoSobrante / tiersConVariedad);
      for (const t of TIERS) {
        if (conteo[t] > UMBRAL) pesos[t] += bonus;
      }
    }
  }

  const total = pesos.bronze + pesos.silver + pesos.gold + pesos.special;
  const r = Math.random() * total;
  let acum = 0;
  for (const t of TIERS) {
    acum += pesos[t];
    if (r < acum) return t;
  }
  return 'special';
}

// Para cada banda pedida, en qué orden probar las demás si esa banda no
// tiene cartas disponibles. Siempre se prueba primero la más cercana en
// "calidad" antes de caer a las más lejanas.
const ORDEN_CERCANIA = {
  bronze: ['bronze', 'silver', 'gold', 'special'],
  silver: ['silver', 'bronze', 'gold', 'special'],
  gold: ['gold', 'special', 'silver', 'bronze'],
  special: ['special', 'gold', 'silver', 'bronze'],
};

// Elige una carta al azar de `candidatas` que pertenezca a la banda
// `bandaPedida`. Si no hay ninguna de esa banda exacta, prueba con las
// bandas más cercanas (ORDEN_CERCANIA) antes de rendirse. Devuelve null si
// `candidatas` no tiene ninguna carta de ninguna banda.
function elegirCartaPorBanda(candidatas, bandaPedida) {
  for (const banda of ORDEN_CERCANIA[bandaPedida]) {
    const deEsaBanda = candidatas.filter(
      (carta) => getTier(carta.overall_rating).toLowerCase() === banda
    );
    if (deEsaBanda.length > 0) {
      return deEsaBanda[Math.floor(Math.random() * deEsaBanda.length)];
    }
  }
  return null;
}

// pool: todas las cartas activas disponibles (mínimo necesitan `id`,
// `position` y `overall_rating`). Devuelve un array de 15 cartas sin
// repetidos.
//
// Cómo arma el plantel:
// 1. Separa el pool en 4 grupos por posición.
// 2. Toma los mínimos garantizados (1 POR, 4 DEF, 3 MED, 3 DEL = 11 cartas).
//    Cada carta se elige ponderando por banda de rareza (pickWeightedTier:
//    15% bronze, 15% silver, 45% gold, 25% special) en vez de uniforme.
// 3. Las 4 cartas que faltan para llegar a 15 también se eligen ponderadas
//    por banda, pero de TODO el resto del pool sin importar posición.
export function draftSquad(pool) {
  const porPosicion = { POR: [], DEF: [], MED: [], DEL: [] };
  for (const carta of pool) {
    porPosicion[carta.position]?.push(carta);
  }

  const seleccionadas = [];
  const idsUsados = new Set();

  for (const [posicion, minimo] of Object.entries(MINIMOS_POR_POSICION)) {
    let disponibles = porPosicion[posicion];
    if (disponibles.length < minimo) {
      throw new Error(
        `No hay suficientes cartas activas en posición ${posicion}: hay ${disponibles.length}, hacen falta ${minimo}`
      );
    }
    for (let i = 0; i < minimo; i++) {
      const banda = pickWeightedTier(disponibles);
      const carta = elegirCartaPorBanda(disponibles, banda);
      seleccionadas.push(carta);
      idsUsados.add(carta.id);
      disponibles = disponibles.filter((c) => c.id !== carta.id);
    }
  }

  const faltantes = TOTAL_CARTAS - seleccionadas.length;
  let poolRestante = pool.filter((carta) => !idsUsados.has(carta.id));

  if (poolRestante.length < faltantes) {
    throw new Error(
      `No hay suficientes cartas activas en el catálogo para completar el plantel de ${TOTAL_CARTAS}`
    );
  }

  for (let i = 0; i < faltantes; i++) {
    const banda = pickWeightedTier(poolRestante);
    const carta = elegirCartaPorBanda(poolRestante, banda);
    seleccionadas.push(carta);
    poolRestante = poolRestante.filter((c) => c.id !== carta.id);
  }

  // Mezclamos de nuevo el orden final: si no, siempre se abrirían primero
  // los arqueros/defensores (el orden en que los fuimos completando arriba).
  return mezclar(seleccionadas);
}

// Corta las 15 cartas en 3 sobres de 5 para la animación de apertura.
export function splitIntoPacks(cards, cardsPerPack = CARTAS_POR_SOBRE) {
  const sobres = [];
  for (let i = 0; i < cards.length; i += cardsPerPack) {
    sobres.push(cards.slice(i, i + cardsPerPack));
  }
  return sobres;
}
