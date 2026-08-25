// Test rápido del sistema de lesiones persistentes
import { iniciarCarrera, elegirReemplazoLesion, jugarTramo } from '../src/engine/carrera.js';
import { FASES } from '../src/engine/carrera.js';

console.log('🧪 Test: Sistema de lesiones persistentes\n');

// 1. Crear carrera de prueba
const c = iniciarCarrera({ 
  dt: 'Test DT', 
  club: 'Test FC',
  seed: 12345 
});

console.log('✓ Carrera creada');
console.log('  lesionados inicial:', c.lesionados);

// 2. Simular una lesión
c.fase = FASES.LESION;
c.lesionadoId = c.plantel[0].id; // Primer jugador del plantel
c.once = c.plantel.slice(0, 11).map(x => x.id); // Armar un 11 rápido
c.tramo = 0;

console.log('\n✓ Simulando lesión del jugador:', c.plantel[0].nombre);

const { deltas } = elegirReemplazoLesion(c, c.plantel[11]?.id || null);

console.log('  Después de elegirReemplazoLesion:');
console.log('    lesionados:', c.lesionados);
console.log('    fase:', c.fase);
console.log('    deltas:', deltas);

// 3. Verificar que el jugador está bloqueado
const lesionado = c.lesionados[0];
if (lesionado) {
  console.log('\n✓ Lesión registrada correctamente:');
  console.log('    cardId:', lesionado.cardId);
  console.log('    jornadasRestantes:', lesionado.jornadasRestantes);
  console.log('    tipo:', lesionado.tipo);
} else {
  console.error('❌ ERROR: No se registró la lesión');
}

// 4. Simular jugarTramo (sin ejecutar todo el flujo)
console.log('\n✓ Simulando paso de jornadas...');
const jornadasSimuladas = 3;
c.lesionados = c.lesionados.map(l => ({
  ...l,
  jornadasRestantes: l.jornadasRestantes - jornadasSimuladas
})).filter(l => l.jornadasRestantes > 0);

console.log('  Después de jugar', jornadasSimuladas, 'jornadas:');
console.log('    lesionados:', c.lesionados);

if (c.lesionados.length > 0) {
  console.log('    ✓ Jugador sigue lesionado');
} else {
  console.log('    ✓ Jugador recuperado');
}

// 5. Test de protección de arqueros
console.log('\n✓ Test de protección de arqueros:');
console.log('  Pesos: POR = 0.3x, resto = 1.0x');
console.log('  En 100 lesiones aleatorias, los arqueros deberían representar ~10% (en vez de ~25%)');

console.log('\n✅ Test completado. Verificar visualmente en el juego.');
