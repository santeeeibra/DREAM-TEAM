# Fotos de Plantel Inicial — encuadre contenido (Enfoque 1)

Fecha: 2026-08-05
Estado: aprobado (act mode)
Skill: superpowers:brainstorming → Enfoque 1

## Contexto
Las cartas (`carta`) en la grilla muestran la foto del jugador como fondo absoluto
(`inset:0; object-fit:cover; object-position:top center`). Desde que las fotos pasaron a
los retratos FUTBIN de 160×160 (cabeza y hombros, casi borde a borde), el `cover` en una
carta vertical 5/7 recorta ~20% de cada lado sobre los hombros y la foto invade hasta el
pie de la carta, donde vive el nombre.

## Problema
- Retrato sobre-encuadrado: corta hombros/cara feo.
- La foto llega hasta la zona inferior (nombre) y compite con el texto.

## Objetivo (referencia: retrato contenido tipo Benjamin White)
- El retrato entra **completo** (hombros visibles, encuadrado limpio).
- **No invade la zona inferior** donde está el nombre.

## Decisión
**Enfoque 1 — retrato `object-fit:contain` anclado arriba con franja inferior reservada.**
Cambio únicamente CSS en `.carta .foto`: dejar de usar `inset:0` + `cover`, y usar
offsets `top:0; left:0; right:0; bottom:56px` + `object-fit:contain; object-position:top center`.

- Sin `width/height` explícitos (con todos los offsets seteados, el `img` estira su caja:
  card completa menos 56px inferiores; `width/height:100%` anularían el `bottom` en
  absolute positioning — quedan **fuera** de la regla).
- El cuadrado 160×160 escala a lo ancho de la carta (o lo que permita la caja), centrado
  arriba; la franja del nombre queda libre.
- El gradiente existente (`.carta.con-foto::after`) y el texto (`z-index:2`) no cambian.

## Implementación
`index.html` → regla `.carta .foto`:
```css
.carta .foto{position:absolute;top:0;left:0;right:0;bottom:56px;object-fit:contain;object-position:top center;z-index:0}
```

## Criterios de éxito
1. En una carta con foto FUTBIN, se ve cabeza y hombros completos, centrados arriba.
2. La zona del nombre no tiene foto detrás (ni contraste ni invasión visual).
3. Cartas sin foto y cartas con foto fut.gg (fallback) no se rompen.
4. `vite build` pasa sin errores.

## Fuera de alcance
- Re-correr imports / re-crops de imágenes (Enfoque 3).
- Cambios de estructura del DOM de la carta (Enfoque 2).
- Ajuste fino del gradiente (se evalúa visualmente después, si molesta).
