## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

---

## Reglas del proyecto

- Las reglas activas viven en `.clinerules/` (00-workflow, 10-arquitectura,
  20-eventos-ia, 30-ui, 40-debug, 50-context-engineering). Esa es la única
  fuente de reglas; este archivo solo documenta el uso de graphify.
- Cartas/sobres y eventos tienen secciones propias en
  `.clinerules/30-ui.md` y `.clinerules/20-eventos-ia.md`.

---

## Contexto del proyecto

- **Stack**: Vite + DOM (HTML/CSS/JS en `src/ui/`) + Supabase + Vercel.
  Serverless en `api/`. No hay Phaser: la capa visual es DOM y el motor es
  lógica pura Node.
- **IA runtime**: GROQ vía proxy serverless (`api/evento.js`). La key nunca va al cliente.
- **Loop**: crear DT → 3 sobres gratis → armar 11 → temporada por tramos → resumen → sobre de refuerzo → siguiente temporada (8 por carrera).
- **Estado**: `money`, `moral`, `fatiga`, `presion`, `ratingDelta`. Fatiga y presión: **subir es malo**.
- **Rarezas**: `bronce`, `oro_comun`, `oro_unico`, `epica` (coinciden con la columna `rarity` en Supabase).
- **Lógica pura**: los módulos bajo `src/engine/` no importan Phaser, Supabase ni DOM. Todo testeable headless.

## Ciclo obligatorio

1. **Explorar** — leer los archivos a tocar antes de proponer nada.
2. **Plan** — máximo 5 bullets. Si toca más de 2 archivos, esperar confirmación.
3. **Editar** — cambios quirúrgicos, nunca reescribir un archivo entero.
4. **Verificar** — correr el harness/build y leer el error real antes del siguiente cambio.

## Reglas duras

- No refactorizar nada que no se pidió.
- No agregar dependencias sin preguntar.
- No crear archivos nuevos si se puede editar uno existente.
- Si hay ambigüedad, preguntar UNA cosa concreta.
- Si un cambio falla 2 veces seguidas, parar y reportar.
