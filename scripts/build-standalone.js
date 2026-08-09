// Genera un HTML de un solo archivo (para probar/compartir sin servidor).
// Misma fuente que el juego real: no hay un segundo código paralelo.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const r = await build({
  entryPoints: ['src/ui/main.js'], bundle: true, format: 'esm',
  write: false, minify: false, target: 'es2020',
});
const js = r.outputFiles[0].text;
const html = readFileSync('index.html', 'utf8')
  .replace('<script type="module" src="/src/ui/main.js"></script>', `<script type="module">\n${js}\n</script>`);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/dream-team.html', html);
console.log('✔ dist/dream-team.html', (html.length / 1024).toFixed(0) + ' KB');
