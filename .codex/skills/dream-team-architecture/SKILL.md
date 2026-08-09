---
name: dream-team-architecture
description: "Activa siempre que toques lógica de juego, estado (money, moral, fatiga, presión, rating-delta) o temporada en este repo (Vite + DOM + Supabase, motor puro Node en src/engine/). Define separación de capas, camino único de mutación con clamps, temporada por tramos y de dónde salen los efectos numéricos."
---

# Arquitectura — INNEGOCIABLE

Activar siempre que toques lógica de juego, estado o temporada.

## Separación de capas
- La lógica pura **no importa Phaser, Supabase ni DOM**. Ni un import. Si
  te hace falta, el diseño está mal: pasá los datos como argumento.
- `src/ui/main.js` (DOM) = solo render e input. Supabase = solo
  persistencia. No hay Phaser: si se migra, se reemplaza la capa visual
  sin tocar el motor.

## Estado
- **Un único camino de mutación.** Toda modificación de money / moral /
  fatiga / presión / rating-delta pasa por la misma función, con clamps
  aplicados ahí adentro. Nunca mutar el objeto de estado a mano.
- Rangos: money sin tope, moral 0–100, fatiga 0–100, presión 0–100,
  rating-delta −20..+20. Fatiga y presión: **subir es malo**.
- Documentá en el código qué es snapshot (congelado al momento) y qué es
  recalculado en cada lectura. Si no está claro, preguntá.

## Temporada
- Se resuelve **por tramos**, nunca partido a partido.
- Progresión por tiers (Regional → Segunda → Primera → Élite), 8
  temporadas por carrera; el objetivo es subir un tier por temporada.

## Efectos numéricos
- Siempre desde el **catálogo local**. La IA jamás devuelve números que
  toquen el estado. La IA elige y narra; los deltas los pone el catálogo.

## Harness
- La primera lógica de estado nueva va con su test headless **en el mismo
  commit**. Sin excepción, sin "después lo agrego".
