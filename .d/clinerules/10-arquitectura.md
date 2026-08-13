## Efectos numéricos
- Siempre desde el **catálogo local**. La IA jamás devuelve números que
  toquen el estado. La IA elige y narra; los deltas los pone el catálogo.
- **Nuevo: PRESION_BRECHA** en `src/engine/balance.js` — constante catalogada
  que define cuánta presión se agrega por cada posición de brecha entre la
  posición real del DT y el objective de la temporada.
- Cuando la posición del DT queda por debajo del objective, se calcula:
  `brecha = miPosicion(liga) - c.objetivo` y se agrega `brecha * TRAMO.PRESION_BRECHA`
  a `delta.presion`, clampeado a `[0, 100]` por regla de arquitectura.