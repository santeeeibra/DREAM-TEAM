# Context Engineering — Agentes

Activar solo cuando la tarea toque contexto, skills o la estructura del repo.

+ ## Exploración rápida
+ Antes de leer archivos crudos, corrés `graphify query "<pregunta>"`.
+ Solo abrís el archivo raw si necesitás ver líneas específicas para editar.
## El reto
- El repo sufre **deriva documental**: mismo dato en varios lugares con
  versiones distintas. Antes de agregar o editar docs, corroborá contra el
  código real (`src/engine/` y `src/data/` son la fuente de verdad).
- Los efectos numéricos **nunca** van en el prompt ni los calcula la IA:
  van en `src/engine/balance.js` o en el catálogo de eventos.

## Reglas Automáticas de Dominio (Habilidad DDD)
- Cada vez que modifiques lógica pura del motor (`src/engine/{state,once,carrera,liga,balance,cartas,sobresLocal,candidatosEvento,narrador,catalogoEventos}.js` o `src/data/`), activá automáticamente las directrices de `.cline/skills/ddd.md`.
- Aplica clamps estrictos a las variables del juego y blinda el slot `ARQ` para uso exclusivo de cartas `POR` bajo cualquier circunstancia.

## Otras habilidades y cuándo activarlas
| Comando / disparador | Habilidad a activar |
|---|---|
| `npm run sim` | `.cline/skills/reflection.md` (o reflection al terminar de tocar motor) |
| Trabajo con IA en producción | `.cline/skills/sdd.md` |
| Especificación de features (draft, sobres, 11, temporada) | `.cline/skills/sdd.md` |
| Estado, clamps o slots ARQ | `.cline/skills/ddd.md` |

## Tarea
- Pensá en contexto como un **presupuesto**. Menos reglas, mejor
  redactadas, que escriban "qué" en vez de "cómo".

## Post-tarea (innegociable)
- Al terminar **cualquier tarea de implementación**, la IA debe actualizar
  automáticamente el registro de contexto (CLAUDE.md o .clinerules/) con las
  modificaciones realizadas, para no perder historial de decisiones arquitectónicas
  o de UI. Usar el subagente `context-updater` cuando la tarea fue multi-archivo.
- No documentar fixes one-off; solo patrones, convenciones y decisiones que
  afecten trabajo futuro.