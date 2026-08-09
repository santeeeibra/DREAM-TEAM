# Brief para Claude Code — Parche integral Dream Team 2

**Objetivo de esta sesión:** cerrar todos los bugs pendientes, integrar el rediseño de cartas y dejar el juego deployado en Vercel para probar desde el celular.

**Regla de eficiencia:** apoyate en graphify (`graphify query/explain/path`) para ubicar todo. NO leas archivos a ciegas uno por uno. Solo abrí un archivo cuando el grafo ya te dijo que es el correcto y necesitás su contenido exacto para editar.

Trabajá en fases. Al terminar cada fase, resumime en 2-3 líneas qué cambiaste antes de pasar a la siguiente.

---

## FASE 0 — Descubrimiento (solo grafo, sin editar nada)

Corré estas consultas y reportame los hallazgos antes de tocar código:

1. `graphify query "cómo se renderizan las cartas de jugador hoy: DOM overlay o objetos Phaser en canvas?"` — **esto define cómo integrar el rediseño**. Si las cartas son DOM/HTML sobre el canvas, el CSS del rediseño se adapta directo. Si son sprites/containers de Phaser, hay que decidir estrategia (overlay DOM vs replicar el look en Phaser). No asumas: decímelo.
2. `graphify query "catálogo de rarezas de cartas y de dónde salen los colores/estilos"` — necesito el shape real de rarezas del juego.
3. `graphify explain "narrador"` y `graphify query "dónde se filtran los eventos por tag y dónde se inyectan nombres de jugador"`.
4. `graphify query "dónde se renderizan los chips de fatiga y presión y su signo +/−"`.
5. `graphify query "TODO FIXME HACK pendiente"` + revisá `GRAPH_REPORT.md` por código no cableado o nodos huérfanos.

**Salida de la fase:** una lista de bugs pendientes (los 2 conocidos de abajo + lo que encuentres) para que prioricemos juntos, y la respuesta a la pregunta 1 (DOM vs Phaser).

---

## FASE 1 — Parches de bugs conocidos

### Bug 1 — `narrador.js`: nombres de jugador en eventos genéricos
La IA mete nombres de jugador/rival en eventos que NO son individuales. Regla correcta: **solo los eventos con tag `'individual'` pueden nombrar a un jugador concreto.** Los genéricos (de club, tácticos, de plantel) nunca deben inyectar un nombre propio. Aplicá el filtro en el punto donde se arma el contexto que va a GROQ y/o donde se valida la respuesta. Mantené el fallback silencioso al sorteo ponderado si la validación falla (regla del proyecto).

### Bug 2 — Chips de fatiga/presión: signo confuso
En fatiga y presión, **subir = malo**, pero el chip lo muestra como si subir fuera bueno (verde/positivo). Invertí la semántica visual **solo para esas dos variables**: cuando suben, color/flecha de "negativo"; cuando bajan, de "positivo". Money, moral y rating-delta mantienen la semántica normal (subir = bueno). No cambies los números del estado, solo la capa de presentación.

### + Bugs de Fase 0
Aplicá también los que hayan salido, empezando por los que rompen producción. Si alguno es ambiguo, preguntame antes.

---

## FASE 2 — Integrar el rediseño de cartas

Fuente: `cartas-rediseno.html` (te lo adjunto / está en la raíz). Reemplaza la UI actual de cartas, que era básica y no centraba bien las fotos.

Qué trae y hay que preservar:
- **4 rarezas**: `bronce`, `oro_comun`, `oro_unico`, `epica`. La energía visual escala con la rareza (bronce plano → épica con foil violeta→magenta→dorado, respiración de glow, rayos girando).
- **Centrado de fotos resuelto**: `.photo-well` con `object-fit:cover` + `object-position:50% 16%` + fade inferior. Esto arregla el "no se ven todos centrados". Reemplazá la silueta SVG placeholder por el `<img>` real del jugador (o dejá la silueta como fallback si no hay foto).
- **Efectos por `data-rarity` + variable `--i`** (índice para el reveal escalonado). Foil que sigue el cursor, glint y flash de celebración **solo en `oro_unico`/`epica`**.
- **Respetá `prefers-reduced-motion`**: ya viene con el bloque que corta el movimiento y deja solo fundido. No lo elimines.

Decisiones a resolver (no las asumas, resolvelas con el catálogo real de Fase 0):
1. **Mapeo de rarezas.** El juego usa bronce/plata/oro común/oro único; el rediseño usa bronce/oro común/oro único/**épica**. Decidí y avisame: ¿`plata` se mapea al estilo `bronce` o se crea un tier intermedio? ¿`epica` es una rareza nueva del juego (para figuras/especiales) o solo un estilo visual? Que el resultado NO deje dos catálogos de rareza en paralelo (antipatrón del proyecto).
2. **DOM vs Phaser** (según Fase 0). Si son objetos Phaser, no metas el CSS a la fuerza: proponeme la estrategia antes de implementar.
3. El CSS del `<style>` va a su propio archivo importable por Vite; el markup, al componente/escena que renderiza cartas. Nada de estilos inline sueltos.

---

## FASE 3 — Deploy a Vercel (para probar desde el celular)

Al terminar y con el harness headless en verde:
1. Verificá que el build de Vite pasa limpio (`npm run build`).
2. Deploy a Vercel (push a la rama que dispara el deploy, o `vercel --prod` según cómo esté configurado el repo).
3. Confirmá que el proxy GROQ (`api/evento.js`) sigue respondiendo en producción — es el punto que ya rompió antes.
4. Pasame la URL de producción para abrirla desde el celular.

---

## Verificación final (checklist)

- [ ] Harness headless pasa (incluidos los asserts de alineación/arranque que ya existían).
- [ ] `narrador.js`: ningún evento genérico nombra jugadores; los `individual` sí.
- [ ] Chips: fatiga/presión muestran subir=malo; las otras variables sin cambios.
- [ ] Cartas: 4 rarezas renderizando, fotos centradas, un solo catálogo de rareza, `prefers-reduced-motion` respetado.
- [ ] Build limpio + deploy Vercel OK + proxy GROQ responde en prod.
- [ ] URL de producción entregada.

Al cerrar, resumime en 2-3 líneas: qué se cambió, qué quedó pendiente, próximo paso.
