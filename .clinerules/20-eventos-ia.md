# Eventos narrativos e IA

Activar solo cuando la tarea toque `narrador.js`, `api/evento.js`,
el catálogo de eventos o los prompts a GROQ.

## Flujo
1. El **orquestador** arma 4-6 candidatos desde el catálogo local.
2. La IA elige cuál narrar y devuelve título + labels de opciones.
3. **Validación estricta** del JSON de vuelta. Si no valida →
   fallback silencioso al sorteo ponderado. Sin romper la partida,
   sin cartel de error al jugador.

## Reglas de contenido
- Un evento tagueado `individual` puede mencionar nombre de jugador.
  Un evento **genérico de club NO puede mencionar nombres** de jugador
  ni de rival. Verificá el tag antes de inyectar nombres al prompt.
- Los eventos buenos son concretos y críticos, no relleno:
  - figura tocada en la previa de un duelo → descansarla o forzarla
  - el rival real del próximo partido cambia de esquema → adaptar o no
- Nada de eventos genéricos tipo "el vestuario está raro".

## Guardrails en código (no solo en el prompt)
- El filtro de nombres propios es un guardrail real en `narrador.js`
  (`nombrePropioFiltrado`), no una sugerencia del prompt. No lo debilités.
- La IA **nunca decide qué rama probabilística toca**: la resuelve
  `efectosDeOpcion` con el RNG de la carrera. La IA solo narra la
  incertidumbre.

## Prohibido
- Que la IA devuelva deltas numéricos.
- Meter la key de GROQ en el bundle del cliente.
- Llamar a la IA en el camino crítico del render.
