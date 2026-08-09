# Dream Team — Contexto para Gemini

## Stack
Vite + DOM (HTML/CSS/JS en `src/ui/`) + Supabase + Vercel. No hay Phaser:
la capa visual es DOM y el motor es lógica pura Node. IA en runtime: GROQ vía
proxy serverless (`api/evento.js`). La API key nunca llega al cliente.

## Reglas del proyecto
- Las reglas activas viven en `.clinerules/` (00-workflow, 10-arquitectura,
  20-eventos-ia, 30-ui, 40-debug, 50-context-engineering). Cartas/sobres y
  eventos tienen secciones propias en `30-ui.md` y `20-eventos-ia.md`.
- Este archivo es contexto de referencia, no duplica reglas.

## Módulos principales

| Archivo | Rol |
|---------|-----|
| `src/engine/candidatosEvento.js` | Orquestador de eventos. Único punto de entrada para sortear un evento. |
| `src/engine/narrador.js` | Construye el prompt y valida la respuesta de GROQ. Puro, sin fetch. |
| `src/net/evento.js` | Hace el fetch a `/api/evento`. Impuro. Timeout 3500ms. |
| `api/evento.js` | Proxy serverless Vercel. Falla ruidosa si falta `GROQ_API_KEY`. |
| `src/engine/cartas.js` | Formatea cartas desde Supabase. Calcula `valorDeVenta`. |
| `src/engine/sobresLocal.js` | Mock local de `open_pack`. Draft inicial garantiza POR/DEF/MED/DEL. |
| `src/ui/cartas.css` | Todo el visual de cartas: rarezas, reveal, foil, foto. |
| `src/ui/main.js` | Capa visual. Solo lee el motor y llama a sus funciones. |

## Reglas de arquitectura (innegociables)

- `src/engine/` es lógica pura: sin imports de Phaser, Supabase ni fetch.
- Un único camino de mutación de estado con clamps.
- Los efectos numéricos siempre desde el catálogo local, nunca desde la IA.
- La IA elige y narra; los números los decide el motor.

## Estado del juego

5 variables: `money`, `moral`, `fatiga`, `presion`, `ratingDelta`.
**Fatiga y presión: subir es malo.** No mostrar `+8` verde en un chip de fatiga.

## Rarezas

`bronce` / `oro_comun` / `oro_unico` / `epica` — coinciden con la columna `rarity` en Supabase.

## Ciclo de trabajo

1. Leer los archivos a tocar antes de proponer nada.
2. Plan en máximo 5 bullets. Si toca más de 2 archivos, esperar confirmación.
3. Cambios quirúrgicos. Nunca reescribir un archivo entero.
4. Verificar con el harness/build antes del siguiente cambio.
