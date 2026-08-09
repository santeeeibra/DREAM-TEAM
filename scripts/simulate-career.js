// Harness headless (§2.1). Corre carreras completas sin Phaser, sin DOM y sin IA.
// Uso: node scripts/simulate-career.js [carreras] [--politica=equilibrada|agresiva|conservadora|random]
import {
  iniciarCarrera, confirmarOnce, jugarTramo, candidatosDelTramo, fijarNarracion,
  resolverEvento, abrirRefuerzo, aplicarRefuerzo, resumenCarrera, FASES,
  autoOnce, CATALOGO, BALANCE_VERSION, RANGOS,
  FORMACION, penalidad, SLOTS_POR_PUESTO_ANCHO,
} from '../src/engine/index.js';

const N = Number(process.argv[2]) || 200;
const politica = (process.argv.find((a) => a.startsWith('--politica=')) || '--politica=equilibrada').split('=')[1];

function decidir(narracion, carrera, rng) {
  const ops = narracion.opciones;
  if (politica === 'random') return ops[Math.floor(rng.next() * ops.length)].id;
  // Heurísticas simples: sirven para ver si el juego es ganable/perdible por decisiones.
  const e = carrera.estado;
  if (politica === 'agresiva') return ops[0].id;
  if (politica === 'conservadora') return ops[ops.length - 1].id;
  if (e.presion > 70) return ops.find((o) => /medid|plan|renov|puertas|tragar/i.test(o.label))?.id || ops[ops.length - 1].id;
  if (e.moral < 40) return ops.find((o) => /banc|disfrut|franco|debut|aflojar/i.test(o.label))?.id || ops[0].id;
  return ops[Math.floor(rng.next() * ops.length)].id;
}

const stats = {
  finales: {}, titulos: 0, campeonAlMenosUna: 0, temporadas: [], posiciones: [],
  moralFinal: [], moneyFinal: [], presionFinal: [], usoPaquetes: {}, clamps: {}, decisiones: 0,
};

for (const p of CATALOGO) stats.usoPaquetes[p.id] = 0;

// — Fase D (§D.2): invariantes del auto-armado. El harness corre 200 seeds distintas,
//   así que cubre el "20 corridas" del brief. Cualquier violación corta la simulación.
const INDICES_POR_SLOT = FORMACION.reduce((m, s, i) => { (m[s] ||= []).push(i); return m; }, {});
const faseD = { arqConPor: 0, arqVacio: 0, fueraDePosicion: 0 };

function autoOnceVerificado(plantel) {
  const once = autoOnce(plantel);
  const porId = new Map(plantel.map((c) => [c.id, c]));

  // Regla dura §D.2: ARQ exclusivo de POR. Vacío solo si no hay POR en el plantel.
  if (once[0]) {
    if (porId.get(once[0])?.pos !== 'POR') {
      throw new Error(`Fase D: ARQ ocupado por un no-POR (${porId.get(once[0])?.nombre})`);
    }
    faseD.arqConPor++;
  } else if (plantel.some((c) => c.pos === 'POR')) {
    throw new Error('Fase D: ARQ quedó vacío con un POR disponible en el plantel');
  } else {
    faseD.arqVacio++;
  }

  // Greedy del brief: una carta solo sale de su puesto natural si no queda ningún
  // slot de coincidencia exacta libre para su puesto ancho.
  FORMACION.forEach((slot, i) => {
    const carta = once[i] ? porId.get(once[i]) : null;
    if (!carta || slot === 'ARQ') return;
    if (penalidad(carta.pos, slot) > 0) {
      const exactoLibre = (SLOTS_POR_PUESTO_ANCHO[carta.pos] || [])
        .some((s) => (INDICES_POR_SLOT[s] || []).some((j) => once[j] == null));
      if (exactoLibre) {
        throw new Error(`Fase D: ${carta.nombre} (${carta.pos}) en ${slot} con slot exacto libre`);
      }
      faseD.fueraDePosicion++;
    }
  });
  return once;
}

console.time('simulacion');
for (let i = 0; i < N; i++) {
  const c = iniciarCarrera({ seed: 1000 + i, dt: 'Harness', club: 'Club Atlético Viedma' });
  confirmarOnce(c, autoOnceVerificado(c.plantel));

  let guardia = 0;
  while (c.fase !== FASES.FIN && guardia++ < 500) {
    if (c.fase === FASES.ONCE) { confirmarOnce(c, autoOnceVerificado(c.plantel)); continue; }
    if (c.fase === FASES.TRAMO) { jugarTramo(c); continue; }
    if (c.fase === FASES.EVENTO) {
      candidatosDelTramo(c);
      const n = fijarNarracion(c, null); // sin IA: sorteo ponderado + texto de respaldo
      stats.usoPaquetes[n.paqueteId]++;
      stats.decisiones++;
      resolverEvento(c, decidir(n, c, c.rng));
      continue;
    }
    if (c.fase === FASES.RESUMEN) {
      const cartas = abrirRefuerzo(c);
      const entran = cartas.filter((x) => x.rating > Math.min(...c.plantel.map((p) => p.rating)));
      const salen = [...c.plantel].sort((a, b) => a.rating - b.rating).slice(0, entran.length).map((x) => x.id);
      aplicarRefuerzo(c, entran.map((x) => x.id), salen);
      continue;
    }
    if (c.fase === FASES.REFUERZO) { aplicarRefuerzo(c, [], []); continue; }
    throw new Error(`Fase desconocida: ${c.fase}`);
  }
  if (guardia >= 500) throw new Error('Loop infinito detectado en la máquina de fases');

  const r = resumenCarrera(c);
  stats.finales[r.motivoFin] = (stats.finales[r.motivoFin] || 0) + 1;
  stats.titulos += r.titulos;
  if (r.titulos > 0) stats.campeonAlMenosUna++;
  stats.temporadas.push(r.temporadasJugadas);
  if (r.posicionPromedio !== null) stats.posiciones.push(r.posicionPromedio);
  stats.moralFinal.push(r.estadoFinal.moral);
  stats.moneyFinal.push(r.estadoFinal.money);
  stats.presionFinal.push(r.estadoFinal.presion);
  for (const h of c.historial) for (const k of h.clamped) stats.clamps[k] = (stats.clamps[k] || 0) + 1;
}
console.timeEnd('simulacion');

const prom = (a) => Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 100) / 100;
const pct = (n) => `${Math.round((n / N) * 1000) / 10}%`;

console.log(`\n── Balance v${BALANCE_VERSION} · ${N} carreras · política "${politica}" ──`);
console.log('Finales           :', Object.entries(stats.finales).map(([k, v]) => `${k} ${pct(v)}`).join('  '));
console.log('Temporadas jugadas:', prom(stats.temporadas), '/ 8');
console.log('Posición promedio :', prom(stats.posiciones));
console.log('Campeón ≥1 vez    :', pct(stats.campeonAlMenosUna), `(${stats.titulos} títulos totales)`);
console.log('Moral final       :', prom(stats.moralFinal), '| Presión final:', prom(stats.presionFinal), '| Plata final:', prom(stats.moneyFinal));
console.log('Decisiones/carrera:', Math.round((stats.decisiones / N) * 10) / 10);

const muertos = Object.entries(stats.usoPaquetes).filter(([, v]) => v === 0);
console.log('\nPaquetes de evento nunca usados:', muertos.length ? muertos.map(([k]) => k).join(', ') : 'ninguno ✔');
const raros = Object.entries(stats.usoPaquetes).sort((a, b) => a[1] - b[1]).slice(0, 3);
console.log('Menos usados      :', raros.map(([k, v]) => `${k}(${v})`).join('  '));

console.log('\nSaturación de clamps (por variable):');
for (const k of Object.keys(RANGOS)) {
  const v = stats.clamps[k] || 0;
  console.log(`  ${k.padEnd(12)} ${v}  ${v > N * 8 ? '⚠ demasiado alto: el rango está mal calibrado' : ''}`);
}

console.log('\nFase D (§D.2): ARQ siempre POR —', `${faseD.arqConPor} ok, ${faseD.arqVacio} vacío sin POR`, '| fuera de posición solo con slot exacto ocupado —', faseD.fueraDePosicion, '✔');
