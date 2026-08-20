// PUENTE TEMPORAL. Mock local de Supabase open_pack() (schema crudo de DB).
// Cuando exista el cliente JS real de Supabase, estos exports pasan a llamar a la API.
// Los sobres iniciales y de refuerzo salen con el shape EXACTO que devuelve la DB:
// { id, fut_id, nombre, pos, overall_rating, rarity, league_id, edad }
import { RAREZAS, SOBRES } from './balance.js';
import { NOMBRES, APODOS } from '../data/nombres.js';
import { PUESTOS_ANCHOS } from '../data/posiciones.js';

const ORDEN_RAREZA = ['bronce', 'oro_comun', 'oro_unico', 'epica'];
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

function cartaCruda(rng, rareza, pos, futIdsUsados = new Set()) {
  const [min, max] = RAREZAS[rareza].rating;
  const usaApodo = rng.next() < 0.25;
  // El id sale del RNG, nunca de un contador global: `rng.state` es inyectivo por carta
  // (cada next() suma un offset fijo), así que misma seed = mismos ids, sin colisiones.
  const id = `c${(rng.state >>> 0).toString(36)}${rng.int(1000, 9999)}`;
  // Elegir una foto de prueba que no se haya usado ya en este sobre: evita que
  // el mismo jugador aparezca dos veces (Raphinha 79 y Raphinha 83).
  const pool = FOTOS_PRUEBA.filter((f) => !futIdsUsados.has(f.fut_id));
  const prueba = pool.length ? rng.pick(pool) : rng.pick(FOTOS_PRUEBA);
  futIdsUsados.add(prueba.fut_id);
  return {
    id,
    fut_id: prueba.fut_id, // el real vendría de la DB
    nombre: usaApodo ? `${prueba.nombre} "${rng.pick(APODOS)}"` : prueba.nombre,
    pos: pos || prueba.pos,
    overall_rating: rng.int(min, max),
    rarity: rareza,
    league_id: 'premier', // la league real vendría de la DB
    edad: edadDeFutId(prueba.fut_id),
    foto: fotoPrueba(prueba.fut_id), // PRUEBA: validar encuadre del CSS
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

function abrirSobre(rng, { cartas, bonus = 0, garantizarPuestos = null, futIdsExcluir = [] }) {
  const out = [];
  const usados = new Set(futIdsExcluir);
  for (let i = 0; i < cartas; i++) {
    out.push(cartaCruda(rng, sortearRareza(rng, bonus), garantizarPuestos?.[i] || null, usados));
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

export function sobreRefuerzo(rng, posicionFinal, futIdsExcluir = []) {
  return abrirSobre(rng, {
    cartas: SOBRES.REFUERZO.cartas,
    bonus: SOBRES.REFUERZO.bonusPorPosicion(posicionFinal),
    futIdsExcluir,
  });
}