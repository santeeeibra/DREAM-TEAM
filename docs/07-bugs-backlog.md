# 07-bugs-backlog

> Registro de bugs del proyecto. Cada entrada tiene estado: **pendiente** (sigue
> abierto) o **resuelto** (con fecha y dónde se arregló). Fuentes de verdad para
> confirmar un fix: `src/engine/` y `src/ui/`.

## Pendientes

- **Fotos iniciales**: jugadores de Premier con OVR < 74 (ej. Sakamoto) tienen
  fotos inconsistentes (JPEG con fondo). Quedaron debajo del umbral `MIN_OVERALL`
  del importador y requieren un fix puntual.
- **Narrativa de eventos (IA)**: las situaciones de GROQ son "raras", poco
  inmersivas o demasiado simples (ej. "Gakpo necesita calentamiento" como dilema
  de temporada). Refinar el prompt en `api/evento.js` o `narrador.js`. Ojo:
  esto es un problema de *calidad* del relato, distinto del bug de nombres
  propios ya resuelto (ver abajo).

## Resueltos

- **2026-08-11 — `narrador.js`: la IA mencionaba jugadores en eventos genéricos**
  — Fix: la figura solo se expone a la IA si el evento tiene tag `individual`
  (`src/engine/narrador.js`); además, `nombrePropioFiltrado()` valida que el
  texto generado no contenga nombres propios en eventos de club. Candidato
  original: Bug 1 en `docs/archivo/brief-dream-team-parche.md`.
- **2026-08-11 — Chips de fatiga/presión: signos `+`/`−` confusos** — Fix:
  `signoDelta()` en `src/ui/main.js` usa flechas de dirección (↑/↓) y color por
  bueno/malo (`MALO_SI_SUBE`: fatiga y presión, subir es malo). Money, moral y
  rating-delta mantienen la semántica normal (subir = bueno). Candidato
  original: Bug 2 en `docs/archivo/brief-dream-team-parche.md`.
