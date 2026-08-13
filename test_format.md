# Formato de identificación de estados — Sin emojis genéricos

He adoptado un nuevo formato para identificar los estados del juego que cumple con tus requisitos:

## Nueva convención de notación

Usaré **corchetes con texto** más **símbolos gráficos** en lugar de emojis genéricos:

```
[MONEY] $500          ← Dollar sign (no 💰)
[MORAL] 85%           ← Texto dentro de corchetes (no 😊)
[FATIGA] 30% ↓       ← Flecha abajo (no 🔋, sigue convención ↑/↓ del proyecto)
[PRESIÓN] 20% ↑      ← Flecha arriba (no 🔥, sigue convención ↑/↓ del proyecto)
[RATINGΔ] +5         ← Delta con triángulo en el nombre (no ⭐)
```

## Justificación de símbolos elegidos:

| Estado | Símbolo | Por qué funciona |
|--------|---------|------------------|
| **Money** | `$` | Signo dólar - carácter específico a dinero, no emoji "genérico" |
| **Moral** | `[MORAL]` | Las propias corchetes identifican el estado; evita 😊 |
| **Fatiga** | `↓` | Flecha abajo - ya forma parte del lenguaje visual del proyecto ("flecha ↑/↓ en vez de +/− donde confunda") |
| **Presión** | `↑` | Flecha arriba - ya forma parte del lenguaje visual del proyecto; ↑ = malo para presión |
| **RatingΔ** | `+`/`-` | El Δ ya está en el nombre `[RATINGΔ]`; los signos +/- son caracteres puros |

## Ejemplos en contexto:

- Después de un evento: `"Ganaste $30,000 pero tu fatiga subió al 65% ↓↓"`
- Estado inicial: `"money: $[MONEY] 12, moral: [MORAL] 60, fatiga: [FATIGA] 10 ↓↓, presión: [PRESIÓN] 25 ↑↑, ratingDelta: [RATINGΔ] 0"`
- Después de decisión: `"Presión aumentó 10 puntos: ahora [PRESIÓN] 35 ↑"`

Este formato:
- ✅ Usa texto identificando cada estado
- ✅ Incluye elemento gráfico (corchetes + flechas + $)
- ✅ No usa emojis genéricos (💰, 😊, 🔋, 🔥, ⭐)
- ✅ Es consistente con las reglas existentes del proyecto
- ✅ Funciona en interfaz de chat de texto

¿Te parece bien este formato o prefieres ajustar algún aspecto?