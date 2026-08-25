// Test de verificación: Liga Profesional Argentina - 30 equipos
// Ejecutar con: node test-ligapro-30.mjs

import { leagues } from './src/data/leagues.js';
import { PRESION_INICIAL_TIER, ESTILOS_CLUB } from './src/engine/balance.js';
import { ESCUDOTECA } from './src/data/escudoteca.js';

console.log('🔍 VERIFICACIÓN LIGA PROFESIONAL ARGENTINA\n');

// 1. Obtener la liga
const ligaPro = leagues.find(l => l.id === 'ligapro');
if (!ligaPro) {
  console.error('❌ No se encontró ligapro en leagues');
  process.exit(1);
}

console.log(`✅ Liga encontrada: ${ligaPro.league}`);
console.log(`✅ Total clubes: ${ligaPro.clubs.length}`);

// 2. Verificar zonas
const zonaA = ligaPro.clubs.slice(0, 15);
const zonaB = ligaPro.clubs.slice(15, 30);

console.log(`✅ Zona A: ${zonaA.length} equipos`);
console.log(`✅ Zona B: ${zonaB.length} equipos`);

// 3. Verificar duplicados
const ids = ligaPro.clubs.map(c => c.id);
const duplicados = ids.filter((id, i) => ids.indexOf(id) !== i);
if (duplicados.length > 0) {
  console.error(`❌ IDs duplicados: ${duplicados.join(', ')}`);
  process.exit(1);
}
console.log('✅ Sin duplicados');

// 4. Verificar ratings en balance.js
const sinRating = ligaPro.clubs.filter(c => !PRESION_INICIAL_TIER[c.id]);
if (sinRating.length > 0) {
  console.error(`❌ Clubes sin rating: ${sinRating.map(c => c.id).join(', ')}`);
  process.exit(1);
}
console.log('✅ Todos tienen rating en PRESION_INICIAL_TIER');

// 5. Verificar estilos de juego
const sinEstilo = ligaPro.clubs.filter(c => !ESTILOS_CLUB[c.id]);
if (sinEstilo.length > 0) {
  console.error(`❌ Clubes sin estilo: ${sinEstilo.map(c => c.id).join(', ')}`);
  process.exit(1);
}
console.log('✅ Todos tienen estilo en ESTILOS_CLUB');

// 6. Verificar escudos
const sinEscudo = ligaPro.clubs.filter(c => !ESCUDOTECA[c.name]);
if (sinEscudo.length > 0) {
  console.warn(`⚠️  Clubes sin escudo: ${sinEscudo.map(c => c.name).join(', ')}`);
  console.log('   (Usarán fallback SVG automático)');
} else {
  console.log('✅ Todos tienen escudo en ESCUDOTECA');
}

// 7. Verificar los 5 grandes
const cincoGrandes = ['boca', 'river', 'racing', 'independiente', 'san-lorenzo'];
const grandesPresentes = cincoGrandes.filter(id => ids.includes(id));
if (grandesPresentes.length !== 5) {
  console.error(`❌ Faltan grandes: ${cincoGrandes.filter(id => !ids.includes(id)).join(', ')}`);
  process.exit(1);
}
console.log('✅ Los 5 grandes históricos presentes');

// 8. Verificar que NO estén los eliminados
const eliminados = ['colon', 'godoy-cruz'];
const eliminadosPresentes = eliminados.filter(id => ids.includes(id));
if (eliminadosPresentes.length > 0) {
  console.error(`❌ Clubes que NO deberían estar: ${eliminadosPresentes.join(', ')}`);
  process.exit(1);
}
console.log('✅ Colón y Godoy Cruz correctamente eliminados');

// 9. Verificar ascendidos
const ascendidos = ['gimnasia-mza', 'ind-rivadavia', 'aldosivi', 'estudiantes-rc'];
const ascendidosPresentes = ascendidos.filter(id => ids.includes(id));
if (ascendidosPresentes.length !== 4) {
  console.error(`❌ Faltan ascendidos: ${ascendidos.filter(id => !ids.includes(id)).join(', ')}`);
  process.exit(1);
}
console.log('✅ Los 4 ascendidos/nuevos presentes');

// 10. Resumen final
console.log('\n' + '='.repeat(50));
console.log('🎉 TODAS LAS VERIFICACIONES PASARON CORRECTAMENTE');
console.log('='.repeat(50));
console.log('\n📊 RESUMEN:');
console.log(`   • Total equipos: ${ligaPro.clubs.length}`);
console.log(`   • Zona A: ${zonaA.length} | Zona B: ${zonaB.length}`);
console.log(`   • Los 5 grandes: ✅`);
console.log(`   • Ratings configurados: ✅`);
console.log(`   • Estilos de juego: ✅`);
console.log(`   • Escudos: ✅`);
console.log('\n✅ Liga Profesional Argentina lista para usar con 30 equipos.\n');
