// PUENTE TEMPORAL. Mock local de Supabase open_pack() (schema crudo de DB).
// Cuando exista el cliente JS real de Supabase, estos exports pasan a llamar a la API.
// Los sobres iniciales y de refuerzo salen con el shape EXACTO que devuelve la DB:
// { id, fut_id, nombre, pos, overall_rating, rarity, league_id, edad }
import { RAREZAS, SOBRES } from './balance.js';
import { NOMBRES, APODOS } from '../data/nombres.js';
import { PUESTOS_ANCHOS } from '../data/posiciones.js';

export const ORDEN_RAREZA = ['bronce', 'oro_comun', 'oro_unico', 'epica'];
// PRUEBA TEMPORAL (revertir): retratos reales para validar el CSS sin Supabase.
const FOTOS_PRUEBA = [
  { fut_id: '231747', nombre: 'Kylian Mbappé', pos: 'DEL' },
  { fut_id: '252371', nombre: 'Jude Bellingham', pos: 'MED' },
  { fut_id: '192119', nombre: 'Thibaut Courtois', pos: 'POR' },
  { fut_id: '238794', nombre: 'Vini Jr.', pos: 'DEL' },
  { fut_id: '233419', nombre: 'Raphinha', pos: 'MED' },
];
const fotoPrueba = (futId) => `https://cdn.futbin.com/content/fifa26/img/players/${futId}.png`;

// Edad deterministica por fut_id: dos cartas del mismo jugador (misma foto de
// prueba) tienen que reportar la MISMA edad, aunque salgan en momentos distintos.
function edadDeFutId(futId) {
  let h = 0;
  for (let i = 0; i < futId.length; i++) h = (h * 31 + futId.charCodeAt(i)) >>> 0;
  return 18 + (h % 17); // 18..34
}

/**
 * Intenta elegir una carta del pool real (DB) que coincida con la rareza
 * sortear y la posición requerida. Devuelve la carta o null si no hay match.
 *
 * Estrategia de selección:
 * 1. Filtra por rareza exacta + posición exacta (si se requiere posición).
 * 2. Si no hay match, relaja la posición (cualquier posición, misma rareza).
 * 3. Si no hay match, prueba rarezas adyacentes (misma posición).
 * 4. Si no hay match, prueba rarezas adyacentes (cualquier posición).
 * 5. Si nada funciona, devuelve null → el caller cae al fallback mock.
 *
 * pool: { local: [...], foreign: [...] }
 * 70% de las veces elige de `local` (liga del DT), 30% de `foreign`.
 */
function pickFromPool(rng, pool, rareza, pos, futIdsUsados) {
  const hasLocal = pool.local?.length > 0;
  const hasForeign = pool.foreign?.length > 0;
  if (!hasLocal && !hasForeign) return null;

  const filterByRarity = (cards, r) => cards.filter(c => c.rarity === r);
  const filterByPos = (cards, p) => p ? cards.filter(c => c.position === p) : cards;
  const excludeUsed = (cards) => cards.filter(c => !futIdsUsados.has(c.fut_id));

  // 70% local (liga del DT), 30% foreign (extranjeros)
  const tryPick = (local, foreign) => {
    const uLocal = filterByPos(excludeUsed(filterByRarity(local, rareza)), pos);
    const uForeign = filterByPos(excludeUsed(filterByRarity(foreign, rareza)), pos);
    // Unir candidatos sin mezclar para mantener el bias 70/30
    if (uLocal.length === 0 && uForeign.length === 0) return null;
    if (uForeign.length === 0) return rng.pick(uLocal);
    if (uLocal.length === 0) return rng.pick(uForeign);
    return rng.next() < 0.7 ? rng.pick(uLocal) : rng.pick(uForeign);
  };

  // Paso 1: rareza exacta + posición exacta
  const pick1 = tryPick(pool.local, pool.foreign);
  if (pick1) { futIdsUsados.add(pick1.fut_id); return pick1; }

  // Paso 2: relajar posición, misma rareza
  const uLocalAnyPos = excludeUsed(filterByRarity(pool.local, rareza));
  const uForeignAnyPos = excludeUsed(filterByRarity(pool.foreign, rareza));
  if (uLocalAnyPos.length > 0 || uForeignAnyPos.length > 0) {
    const pick2 = uLocalAnyPos.length === 0 ? rng.pick(uForeignAnyPos)
      : uForeignAnyPos.length === 0 ? rng.pick(uLocalAnyPos)
      : (rng.next() < 0.7 ? rng.pick(uLocalAnyPos) : rng.pick(uForeignAnyPos));
    futIdsUsados.add(pick2.fut_id);
    return pick2;
  }

  // Paso 3: rarezas adyacentes (intentar con/sin posición)
  const rIdx = ORDEN_RAREZA.indexOf(rareza);
  const adyacentes = [ORDEN_RAREZA[rIdx + 1], ORDEN_RAREZA[rIdx - 1]].filter(Boolean);
  for (const alt of adyacentes) {
    // Con posición exacta
    const uLAlt = filterByPos(excludeUsed(filterByRarity(pool.local, alt)), pos);
    const uFAlt = filterByPos(excludeUsed(filterByRarity(pool.foreign, alt)), pos);
    if (uLAlt.length > 0 || uFAlt.length > 0) {
      const pick3 = uLAlt.length === 0 ? rng.pick(uFAlt)
        : uFAlt.length === 0 ? rng.pick(uLAlt)
        : (rng.next() < 0.7 ? rng.pick(uLAlt) : rng.pick(uFAlt));
      futIdsUsados.add(pick3.fut_id);
      return pick3;
    }
    // Sin posición (relajar)
    const uLAltAny = excludeUsed(filterByRarity(pool.local, alt));
    const uFAltAny = excludeUsed(filterByRarity(pool.foreign, alt));
    if (uLAltAny.length > 0 || uFAltAny.length > 0) {
      const pick3b = uLAltAny.length === 0 ? rng.pick(uFAltAny)
        : uFAltAny.length === 0 ? rng.pick(uLAltAny)
        : (rng.next() < 0.7 ? rng.pick(uLAltAny) : rng.pick(uFAltAny));
      futIdsUsados.add(pick3b.fut_id);
      return pick3b;
    }
  }

  // Paso 4: cualquier rareza, cualquier posición
  const anyLocal = excludeUsed(pool.local);
  const anyForeign = excludeUsed(pool.foreign);
  if (anyLocal.length === 0 && anyForeign.length === 0) return null;
  const pick4 = anyLocal.length === 0 ? rng.pick(anyForeign)
    : anyForeign.length === 0 ? rng.pick(anyLocal)
    : (rng.next() < 0.7 ? rng.pick(anyLocal) : rng.pick(anyForeign));
  futIdsUsados.add(pick4.fut_id);
  return pick4;
}

/** Mapea una carta cruda de la DB al shape que espera cargarCartasDB. */
function mapearCartaDB(carta, rng, raritySorteada, pos) {
  const usaApodo = rng.next() < 0.25;
  return {
    id: carta.id || `c${(rng.state >>> 0).toString(36)}${rng.int(1000, 9999)}`,
    fut_id: carta.fut_id,
    nombre: usaApodo && carta.name ? `${carta.name} "${rng.pick(APODOS)}"` : (carta.name || 'Jugador'),
    pos: pos || carta.position,
    overall_rating: carta.overall_rating,
    rarity: raritySorteada, // usamos la rareza sorteada (puede ser adyacente)
    league_id: carta.league_id,
    edad: carta.date_of_birth
      ? Math.floor((Date.now() - new Date(carta.date_of_birth).getTime()) / 31557600000)
      : (carta.edad || 24),
    photo_url: carta.photo_url || null,
  };
}

function cartaCruda(rng, rareza, pos, futIdsUsados = new Set(), pool = null) {
  // Intentar con pool real (Supabase)
  if (pool && (pool.local?.length > 0 || pool.foreign?.length > 0)) {
    const pick = pickFromPool(rng, pool, rareza, pos, futIdsUsados);
    if (pick) return mapearCartaDB(pick, rng, rareza, pos);
    // Pool agotado: caer al fallback mock
  }

  // Fallback: mock local (FOTOS_PRUEBA) — shape DB: overall_rating, rarity
  const [min, max] = RAREZAS[rareza].rating;
  const usaApodo = rng.next() < 0.25;
  const id = `c${(rng.state >>> 0).toString(36)}${rng.int(1000, 9999)}`;
  const mockPool = FOTOS_PRUEBA.filter((f) => !futIdsUsados.has(f.fut_id));
  const prueba = mockPool.length ? rng.pick(mockPool) : rng.pick(FOTOS_PRUEBA);
  futIdsUsados.add(prueba.fut_id);
  return {
    id,
    fut_id: prueba.fut_id,
    nombre: usaApodo ? `${prueba.nombre} "${rng.pick(APODOS)}"` : prueba.nombre,
    pos: pos || prueba.pos,
    overall_rating: rng.int(min, max),
    rarity: rareza,
    league_id: 'premier',
    edad: edadDeFutId(prueba.fut_id),
    photo_url: fotoPrueba(prueba.fut_id),
  };
}

function sortearRareza(rng, bonus = 0) {
  const pool = Object.entries(RAREZAS).map(([nombre, r]) => ({ nombre, peso: r.peso }));
  let elegida = rng.weighted(pool).nombre;
  // El bonus del sobre de refuerzo sube el piso de rareza, no rompe la tabla.
  for (let i = 0; i < bonus; i++) {
    if (rng.next() < 0.45) {
      const idx = Math.min(ORDEN_RAREZA.indexOf(elegida) + 1, ORDEN_RAREZA.length - 1);
      elegida = ORDEN_RAREZA[idx];
    }
  }
  return elegida;
}

function abrirSobre(rng, { cartas, bonus = 0, garantizarPuestos = null, futIdsExcluir = [], pool = null }) {
  const out = [];
  const usados = new Set(futIdsExcluir);
  for (let i = 0; i < cartas; i++) {
    out.push(cartaCruda(rng, sortearRareza(rng, bonus), garantizarPuestos?.[i] || null, usados, pool));
  }
  return out;
}

/** Los 3 sobres iniciales garantizan un 11 armable: 1 ARQ y cobertura básica. */
export function sobresIniciales(rng) {
  // Puestos ANCHOS (los mismos 4 valores que cards.position_type en Supabase), no slots finos.
  // Garantiza 1 POR, 4 DEF, 3 MED y 3 DEL: alcanza para un 4-3-3 completo sin fuera de puesto.
  const garantias = [
    ['POR', 'DEF', 'DEF', 'MED', 'DEL'],
    ['DEF', 'DEF', 'MED', 'DEL', null],
    ['MED', 'DEL', null, null, null],
  ];
  return garantias.map((g) => abrirSobre(rng, { cartas: SOBRES.INICIAL.cartas, bonus: SOBRES.INICIAL.bonus, garantizarPuestos: g }));
}

export function sobreRefuerzo(rng, posicionFinal, futIdsExcluir = [], pool = null) {
  return abrirSobre(rng, {
    cartas: SOBRES.REFUERZO.cartas,
    bonus: SOBRES.REFUERZO.bonusPorPosicion(posicionFinal),
    futIdsExcluir,
    pool,
  });
}