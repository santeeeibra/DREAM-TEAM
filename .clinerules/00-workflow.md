# Modo de trabajo — SIEMPRE ACTIVO

Trabajás en Dream Team. Seguí este ciclo en toda tarea, sin excepción.

## Ciclo por tarea
1. **EXPLORAR** — Leé los archivos que vas a tocar antes de proponer nada.
   Prohibido asumir nombres de funciones, props, columnas o rutas sin abrir
   el archivo. Si no leíste, no opinás.
2. **PLAN** — Máximo 5 bullets: qué archivos tocás y por qué.
   Si el plan toca más de 2 archivos, esperá mi "dale" antes de editar.
3. **EDITAR** — `replace_in_file` siempre. Nunca reescribir un archivo entero.
   Un cambio conceptual por vez.
4. **VERIFICAR** — Corré el harness / build y leé el error real antes de
   proponer el siguiente cambio. No encadenes fixes a ciegas.

## Reglas duras
- No refactorizar nada que no te pedí.
- No agregar dependencias sin preguntar.
- No crear archivos nuevos si se puede editar uno existente.
- Si hay ambigüedad, preguntá UNA cosa concreta. No adivines.
- Respuestas cortas: sin resúmenes largos, sin explicar lo obvio,
  sin repetir el código que ya edité.
- Si un cambio falla 2 veces seguidas, PARÁ y contame qué viste.
- No des nada por confirmado sin re-verificar en el archivo real.

## Contexto del proyecto
- Stack: Vite + DOM (HTML/CSS/JS en `src/ui/`) + Supabase + Vercel.
  Serverless en `api/`. No hay Phaser: la capa visual es DOM y el motor
  es lógica pura Node. Si algún día se migra, se reemplaza `src/ui/`.
- IA runtime: GROQ vía proxy serverless (`api/evento.js`). La key nunca
  va al cliente.
- Loop: crear DT → 3 sobres gratis → armar 11 → temporada por tramos →
  resumen → sobre de refuerzo → siguiente temporada (8 por carrera).
- Estado del juego: money, moral, fatiga, presión, rating-delta.
  Fatiga y presión: SUBIR ES MALO.

## Antipatrones — si detectás uno, avisá antes de seguir
- Dos sistemas paralelos haciendo lo mismo sin decidir cuál queda.
- Fallback silencioso en configuración (en lógica de eventos sí va).
- Código escrito pero nunca cableado a nada.
- Mocks con un shape distinto al real.
