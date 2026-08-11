# 04-eventos-narrator
Fuente de verdad: `src/engine/narrador.js` (prompt + validación). El fetch de GROQ vive en `src/net/evento.js`.

## Rol
- Módulo puro: arma el prompt para la IA y valida la respuesta. **NO hace fetch** → el harness headless testea la validación sin llamar a ningún modelo.
- La IA elige qué narrar y devuelve título + labels. Los deltas los pone el catálogo local; la IA **nunca** devuelve números.

## Límites
- `LIMITES` — `titulo` ≤ 60, `texto` ≤ 320, `label` ≤ 42 caracteres.

## Traducción de efectos a narrativa
- `pistasDeEfectos(efectos)` — convierte deltas numéricos en directivas conceptuales ("Sube la moral del equipo/jugador", "Aumenta el desgaste o riesgo físico", "Ingresa dinero al club"…). Evita que la IA vea `{ fatiga: 12 }` y lo narre literal. Sin efectos → "Efecto neutro".
- `traducirEfectosParaIA(opcion)` — si la opción tiene ramas (`resultado[]` con `prob`), las ordena de mayor a menor y las presenta como "Lo más probable: … / Pero hay riesgo real de que en cambio: …". El número exacto de probabilidad NO se revela a la IA: solo qué desenlace es el más probable y cuál el riesgo. La rama la resuelve `efectosDeOpcion` con el RNG de la carrera, no la IA.

## Prompt
- `construirPrompt(candidatos, ctx)` → `{ sistema, usuario }`.
  - Por candidato: `id`, `tags`, `figura` (`{ nombre, pos }` **solo si el tag es `individual`**; si no, `null` y el guardrail aplica igual), `opciones` con `id` + `consecuencia_a_justificar`.
  - System: guionista de un FM argentino; regla de oro: nunca mencionar stats, porcentajes, "moral", "fatiga", "plata" ni términos de videojuego literales; anclar el relato a algo concreto (próximo rival, racha, vestuario, caja); riesgo genuino sin decir "probabilidad"; nombre real de figura/rival solo con tag `individual`; responder solo JSON válido; tono rioplatense serio.
  - Usuario: contexto (`dt`, `club`, `temporada`, `tramo + 1`, `posicion`, `racha`, `proximoRival { nombre, localia } | null`) + `candidatos_para_elegir`. No se mandan stats crudos del equipo.

## Validación estricta
- `nombrePropioFiltrado(paquete, texto, ctx)` — **guardrail real en código** (el prompt es una sugerencia, no una garantía): si el paquete elegido NO tiene tag `individual`, ningún nombre propio puede aparecer. Nombres chequeados: `paquete.figura?.nombre`, `ctx.figura?.nombre`, `ctx.rival?.nombre`. Devuelve `true` si hay match → narración inválida. **No debilitar esta función.**
- `validarNarracion(respuesta, candidatos, ctx)` → narración normalizada o `null`. Reglas:
  - `paqueteId` debe ser uno de los candidatos ofrecidos.
  - `titulo`/`texto`/`labels` pasan `esTexto` (string, trim no vacío, ≤ límite).
  - `opciones`: exactamente las del paquete elegido, con sus mismos `id`s.
  - el conjunto título + texto + labels pasa el filtro de nombres propios.
  - Devuelve `{ paqueteId, titulo, texto, opciones: [{ id, label }], fuente: 'ia' }`.
  - `null` ⇒ el llamador cae al **sorteo ponderado + texto de respaldo**, sin avisarle al jugador (fallback silencioso; no rompe la partida).
- Helpers: `esTexto(v, max)`, `limpiar(s)` (saca ```json / ```).

## Reglas importantes
- Un evento genérico de club **no puede** mencionar nombres de jugador ni de rival; solo los tagueados `individual` (verificar el tag antes de inyectar nombres al prompt).
- La IA nunca decide qué rama probabilística toca: la resuelve `efectosDeOpcion` con el RNG de la carrera; la IA solo narra la incertidumbre.
- Rotación de figuras: ningún jugador es el objetivo de dos eventos **visibles** seguidos. `figuraConRotacion` sortea evitando `figurasRecientes` (los últimos `ROTACION_VENTANA` ids con `figura` en `historialEventos` — solo los eventos `individual` y graves registran figura). El grave de difícil (lesión/suspensión de la figura) ya no apunta siempre a `ctx.figura`: rota el objetivo sobre el XI. La memoria vive persistida (retrocompatible con partidas viejas sin key `figura`), así el sorteo sigue siendo determinista tras un save/load.
- No llamar a la IA en el camino crítico del render.
- La key de GROQ nunca va al bundle del cliente (proxy serverless).
