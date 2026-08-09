// logger.js — wrapper de console.* gateado por import.meta.env.DEV (mismo
// flag que usa src/dev/DevPanel.js), para que un build de producción
// (`npm run build`) no imprima nada de esto.
const DEV_MODE = import.meta.env.DEV;

export function log(...args) {
  if (DEV_MODE) console.log(...args);
}

export function warn(...args) {
  if (DEV_MODE) console.warn(...args);
}

export function error(...args) {
  if (DEV_MODE) console.error(...args);
}
