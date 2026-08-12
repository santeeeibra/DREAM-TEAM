// Harness headless (§2.1). Corre carreras completas sin Phaser, sin DOM y sin IA.
// Uso: node scripts/simulate-career.js [carreras] [--politica=equilibrada|agresiva|conservadora|random]
import {
  iniciarCarrera, confirmarOnce, jugarTramo, candidatosDelTramo, fijarNarracion,
  resolverEvento, abrirRefuerzo, aplicarRefuerzo, resumenCarrera, FASES,
  autoOnce, CATALOGO, BALANCE_VERSION, RANGOS, TIER_LIGA, TIER_LIGA_DEFAULT,
  FORMACION, penalidad, SLOTS_POR_PUESTO_ANCHO, ratingEnSlot,
} from '../src/engine/index.js';

const N = Number(process.argv[2]) || 200;
const politica = (process.argv.find((a) => a.startsWith('--politica=')) || '--politica=equilibrada').split('=')[1];
// Default dificil: es donde viven los graves (rotación de figuras) — el modo
// fácil no los ejercita y el invariante de rotación no tendría qué medir.
const modo = (process.argv.find((a) => a.startsWith('--modo=')) || '--modo=dificil').split('=')[1];
// Arena por liga/club reales (slugs de leagues.js). Sin flags, se corre la
// arena legacy (club sin liga → liga.js usa los clubes reales de Premier como
// rivales de respaldo). Ej.: node scripts/simulate-career.js 200 --liga=laliga --club=barcelona
const liga = (process.argv.find((a) => a.startsWith('--liga=')) || '').split('=')[1] || null;
const clubSel = (process.argv.find((a) => a.startsWith('--club=')) || '').split('=')[1] || null;

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
  campeonTier: {}, concentracionFiguras: [],
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

  // Condición H1' (§D.2): optimalidad del XI. Ningún jugador fuera del once puede
  // mejorar el rating efectivo de un slot de campo → autoOnce devolvió el mejor 11
  // posible para este plantel. Un slot vacío solo es válido si no queda ningún
  // jugador de campo libre (si no, el húngaro lo habría llenado).
  const fueraDelOnce = plantel.filter((c) => !once.includes(c.id) && c.pos !== 'POR');
  FORMACION.forEach((slot, i) => {
    if (slot === 'ARQ') return;
    const actual = once[i] ? porId.get(once[i]) : null;
    for (const k of fueraDelOnce) {
      if (ratingEnSlot(k, slot) > (actual ? ratingEnSlot(actual, slot) : -1)) {
        throw new Error(
          `Fase D (óptimo): ${k.nombre} (${k.pos},${k.rating}) mejora ${slot} (${actual ? actual.nombre : 'vacío'}) y no está en el XI`
        );
      }
    }
  });
  return once;
}

console.time('simulacion');
for (let i = 0; i < N; i++) {
  const c = iniciarCarrera({ seed: 1000 + i, dt: 'Harness', club: clubSel || 'Club Atlético Viedma', leagueId: liga, modo });
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
      // Invariante de rotación (§ eventos): ningún jugador es el objetivo de dos
      // eventos VISIBLES seguidos (solo cuentan los que nombran figura:
      // individuales y graves). Lo garantiza figuraConRotacion + figurasRecientes.
      const visibles = c.historialEventos.filter((h) => h.figura != null);
      const ult = visibles[visibles.length - 1], ant = visibles[visibles.length - 2];
      if (ult && ant && ult.figura === ant.figura) {
        throw new Error(`Rotación rota: ${n.paqueteId} nombró dos veces seguidas la figura ${ult.figura}`);
      }
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

  // Tier del campeón de cada temporada cerrada: los rivales sacan fuerza de su
  // banda (TIER_LIGA → FUERZA_POR_TIER), así un bajo jamás debería ser campeón
  // y un medio casi nunca.
  for (const t of c.temporadas) {
    const lider = t.tablaTop5[0];
    if (!lider) continue;
    const tier = lider.esMio ? 'mio' : TIER_LIGA[lider.clubId] ?? TIER_LIGA_DEFAULT;
    stats.campeonTier[tier] = (stats.campeonTier[tier] || 0) + 1;
  }

  // Concentración de la figura más nombrada (share), solo en carreras con ≥ 8
  // eventos visibles, para que la rotación tenga carrera para medirse.
  const visiblesCarrera = c.historialEventos.filter((h) => h.figura != null);
  if (visiblesCarrera.length >= 8) {
    const porJugador = {};
    for (const h of visiblesCarrera) porJugador[h.figura] = (porJugador[h.figura] || 0) + 1;
    stats.concentracionFiguras.push(Math.max(...Object.values(porJugador)) / visiblesCarrera.length);
  }
}
console.timeEnd('simulacion');

const prom = (a) => Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 100) / 100;
const pct = (n) => `${Math.round((n / N) * 1000) / 10}%`;

console.log(`\n── Balance v${BALANCE_VERSION} · ${N} carreras · política "${politica}" · modo "${modo}" ──`);
console.log('Finales           :', Object.entries(stats.finales).map(([k, v]) => `${k} ${pct(v)}`).join('  '));
console.log('Temporadas jugadas:', prom(stats.temporadas), '/ 8');
console.log('Posición promedio :', prom(stats.posiciones));
console.log('Campeón ≥1 vez    :', pct(stats.campeonAlMenosUna), `(${stats.titulos} títulos totales)`);
const temporadasTotales = stats.temporadas.reduce((s, x) => s + x, 0) || 1;
const pctTemp = (n) => `${Math.round((n / temporadasTotales) * 1000) / 10}%`;
console.log('Campeón por tier  :', Object.entries(stats.campeonTier).map(([k, v]) => `${k} ${pctTemp(v)}`).join('  '));
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

const conc = stats.concentracionFiguras;
if (conc.length) {
  const shareMax = Math.max(...conc);
  const shareProm = Math.round((conc.reduce((s, x) => s + x, 0) / conc.length) * 1000) / 10;
  console.log('Rotación de figuras: sin repetir objetivo en eventos visibles seguidos ✔ | top share por carrera (≥8 visibles):',
    `prom ${shareProm}%`, `| peor ${Math.round(shareMax * 1000) / 10}% (${conc.length} carreras medidas)`);
} else {
  console.log('Rotación de figuras: sin medición (ninguna carrera llegó a 8 eventos visibles)');
}

// — Invariantes duros v1.3.0 (§ jerarquía de liga y rotación) —
const bajosCampeones = stats.campeonTier['bajo'] || 0;
const mediosCampeones = stats.campeonTier['medio'] || 0;
if (bajosCampeones > 0) {
  throw new Error(`Jerarquía rota: un club de tier bajo salió campeón ${bajosCampeones}/${temporadasTotales} temporadas`);
}
if (mediosCampeones > Math.max(2, Math.round(temporadasTotales * 0.01))) {
  throw new Error(`Jerarquía rota: clubs de tier medio campeones ${mediosCampeones}/${temporadasTotales} (>1%)`);
}
if (conc.length && Math.max(...conc) > 0.35) {
  throw new Error(`Rotación rota: la figura más nombrada concentró ${Math.round(Math.max(...conc) * 1000) / 10}% en una carrera`);
}
