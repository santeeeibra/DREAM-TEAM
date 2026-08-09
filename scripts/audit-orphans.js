// Antipatrón 3: código construido y nunca cableado.
// Recorre src/ y marca todo módulo que nadie importa (salvo puntos de entrada).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';

const RAIZ = resolve(process.cwd(), 'src');
const ENTRADAS = ['src/ui/main.js', 'src/engine/index.js'];

const archivos = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') && archivos.push(p);
  }
})(RAIZ);

const importados = new Set();
for (const a of archivos) {
  const src = readFileSync(a, 'utf8');
  for (const m of src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    importados.add(relative(process.cwd(), resolve(dirname(a), m[1])));
  }
}

const huerfanos = archivos
  .map((a) => relative(process.cwd(), a))
  .filter((a) => !importados.has(a) && !ENTRADAS.includes(a));

// También: paquetes de evento sin uso posible y catálogos duplicados.
if (huerfanos.length) {
  console.error('⚠ Módulos que nadie importa (candidatos a código muerto):');
  huerfanos.forEach((h) => console.error('   -', h));
  process.exitCode = 1;
} else {
  console.log('✔ Ningún módulo huérfano. Todo lo construido está cableado.');
}
