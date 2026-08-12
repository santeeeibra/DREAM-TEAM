# Dream Team — Contexto de Proyecto

## Stack
- Vite + DOM (HTML/CSS/JS en `src/ui/`) + Supabase + Vercel. No hay Phaser:
  la capa visual es DOM y el motor es lógica pura Node. Si algún día se
  migra a Phaser, se reemplaza `src/ui/` sin tocar el motor.
- GROQ para IA en runtime (proxy serverless en `api/evento.js`; la key nunca
  va al cliente).
- Deploy: dream-team-ruddy.vercel.app

## Reglas del proyecto
- Las reglas activas viven en `.clinerules/` (00-workflow, 10-arquitectura,
  20-eventos-ia, 30-ui, 40-debug, 50-context-engineering). Este archivo es
  contexto de referencia, no duplica reglas.
- Núcleo: lógica pura sin imports de Phaser/Supabase/DOM; un único camino de
  mutación con clamps; temporada por tramos; efectos numéricos desde catálogo
  local; harness headless en el mismo commit.

## Estado del juego
- money, moral, fatiga, presión, rating-delta. Fatiga y presión: subir es malo.
- Loop: crear DT → onboarding (nombre, país, liga, club) → 3 sobres gratis →
  armar 11 → temporada por tramos (8) → resumen → sobre de refuerzo →
  siguiente temporada (8 por carrera).

## Motor (lógica pura — corre en Node)
- `src/engine/carrera.js` — orquestador de la carrera (fases del loop)
- `src/engine/once.js` — rating del 11 + penalidad por slot
- `src/engine/liga.js` — fixture + simulación por tramos
- `src/engine/state.js` — único camino de mutación con clamps
- `src/engine/balance.js` — todos los números, versionados (BALANCE_VERSION)
- `src/engine/cartas.js` — rarezas, valorDeVenta, envejecer plantel
- `src/engine/sobresLocal.js` — sobres iniciales y de refuerzo (garantía de puestos)
- `src/engine/catalogoEventos.js` — catálogo de eventos + efectos (deltas locales)
- `src/engine/candidatosEvento.js` — orquestador de eventos (4-6 candidatos)
- `src/engine/narrador.js` — prompt + validación estricta + guardrail de nombres
- `src/engine/rng.js` — RNG determinista y serializable (seed)
- `src/data/` — nombres.js, posiciones.js (pool de jugadores, penalidad por slot)
- `src/net/` — evento.js (fetch al proxy), supabaseClient.js
- `src/ui/main.js` — capa visual (DOM)

## Base de datos — Supabase (vtulaokxfljnqbkudvbk, sa-east-1)
- `cards`: Jugadores. Rareza: bronce/oro_comun/oro_unico/epica. position_type:
  POR/DEF/MED/DEL. Índice único parcial: `(league_id, fut_id) WHERE fut_id IS NOT NULL`.
  El `fut_id` siempre mapea a `basePlayerEaId` (no al `eaId` del ítem) para evitar duplicados.
- `managers`: Una fila por run. Columnas: id, name, country, money, current_season,
  status, created_at, league_id, club_id.

## Scripts y Herramientas (Importador FUT)
- `scripts/import-futgg-league.mjs`: Importador de ligas.
- **Imágenes:** extraer el retrato transparente (`p.imageUrl` en FUT.GG, WebP).
  Fallback a renders de FUTBIN.
- **Storage:** subida de fotos con `x-upsert: true` (bypass de caché) para pisar
  assets erróneos anteriores (PNGs opacos).
- Harness: `npm run sim`. Smoke UI: `node scripts/smoke-ui.js`.

## Bugs conocidos pendientes
- Fotos iniciales: jugadores de Premier con OVR < 74 (ej. Sakamoto) tienen fotos
  inconsistentes (JPEG con fondo). Quedaron debajo del umbral `MIN_OVERALL` del
  importador y requieren un fix puntual.
- Narrativa de eventos (IA): las situaciones de GROQ son "raras", poco inmersivas o
  demasiado simples (ej. "Gakpo necesita calentamiento" como dilema de temporada).
  Refinar el prompt en `api/evento.js` o `narrador.js`. (Es un problema de calidad
  del relato; ya no hay riesgo de que la IA nombre jugadores en eventos genéricos —
  eso se resolvió el 2026-08-11.)

## Bugs resueltos (2026-08-11)
- IA mencionaba jugadores en eventos genéricos → la figura solo se expone con tag
  `individual` (`src/engine/narrador.js`, guardrail `nombrePropioFiltrado`).
- Chips de fatiga/presión con signos `+`/`−` confusos → flechas ↑/↓ y color por
  bueno/malo (`src/ui/main.js`, `MALO_SI_SUBE`).

## Onboarding
- Flujo: nombre → país → liga → club → 3 sobres gratis → draft
- Draft cierra si se acaba el presupuesto (no muestra rondas vacías)
- Club elegido define dificultad: grande/mediano/chico (presupuesto, presión, moral)