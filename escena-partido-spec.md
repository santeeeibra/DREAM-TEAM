# Dream Team — Escena de partido (MatchScene)

Especificación visual. Complementa a `motor-partido-spec.md`.

**Regla de oro:** el motor calcula todo el partido de una vez, antes de que empiece la animación.
La escena solo *reproduce* una lista de eventos ya resuelta. No hay lógica de juego acá.

---

## Estructura general

```
MatchScene
├── recibe: resultado del motor (marcador, eventos[], estadísticas, figura)
├── construye una cola de animaciones a partir de eventos[]
└── las reproduce una por una, con un reloj que corre en paralelo
```

Duración total objetivo: **~38 segundos**. Botón de saltear siempre visible pero discreto.

---

## Fase 1 — Previa (3 s)

- Los dos nombres de equipo entran desde los costados y se frenan en el centro con un rebote corto (`Back.easeOut`).
- Entre ambos, la formación de cada uno (ej. "4-3-3") en texto chico.
- Marcador arranca en **0 – 0**.
- El reloj arranca en **0'**.

**No mostrar overalls de equipo.** Si el jugador ve "88 vs 74" antes de empezar, ya sabe cómo termina.

---

## Fase 2 — El partido (~28 s)

### El reloj

Corre de 0' a 90' a velocidad variable:

| Situación | Velocidad |
|---|---|
| Tramo normal | 6 minutos de juego por segundo real |
| 4 minutos antes de una ocasión | baja progresivamente hasta 1.5 min/seg |
| Durante la animación de un evento | congelado |
| Después del evento | vuelve a acelerar |

**Esta desaceleración es la pieza más importante de toda la escena.** El jugador aprende
rápido que cuando el reloj frena viene algo, y a partir de ahí cada frenada genera
expectativa por sí sola. Es prácticamente gratis y es la mayor parte del efecto.

Debajo del reloj, una barra de progreso del partido (0 a 90).

### Jerarquía de duración

La duración de cada evento *es* su importancia. Si todos duran lo mismo, ninguno importa.

| Evento | Duración | Tratamiento |
|---|---|---|
| **Gol** | 2.2 s | Ver abajo |
| **Palo** | 3.0 s | Ver abajo — el más largo |
| **Atajada** | 1.0 s | Carta chica del arquero entra desde abajo, texto "¡Atajadón de X!", sin shake |
| **Afuera / bloqueo** | 0 s | Solo una línea en el ticker inferior. El reloj **no** se detiene |

Que los tiros afuera y bloqueos no cuesten tiempo es lo que permite tener 18–24 ocasiones
sin que el partido dure dos minutos.

### Animación de gol (2.2 s)

Secuencia:

1. **0.0 s** — flash del color del equipo sobre toda la pantalla, opacidad 0.6 → 0 en 0.3 s
2. **0.1 s** — screen shake corto (amplitud 8 px, 0.25 s)
3. **0.2 s** — la carta del goleador entra desde abajo con escala 0.5 → 1.0, `Back.easeOut`
   - reutiliza `CardSprite.js`, que ya está hecho
4. **0.5 s** — texto grande "¡GOL!" + nombre del jugador + minuto
5. **0.7 s** — el número del marcador hace un punch (escala 1.0 → 1.4 → 1.0) al cambiar
6. **1.0 s** — si hubo asistencia, texto chico debajo: "asistencia: [nombre]"
7. **1.6 s** — todo sale con fade, el reloj vuelve a correr

### Animación de palo (3.0 s) — el mejor momento del juego

**Arranca con la animación de gol exacta.** Misma frenada de reloj, mismo flash, misma carta
entrando, y el marcador incluso empieza a moverse.

Y entonces, a los 0.9 s: se corta. El flash se apaga de golpe, la carta se frena a mitad de
camino, el marcador vuelve a su número original, y aparece **"¡PALO!"** con un sonido seco.

Es la única forma barata de generar un pico emocional real. Por eso en el motor el palo tiene
12% de probabilidad y no 5%.

### Meter un gol vs recibirlo

Mismo evento, tratamiento opuesto. Esto no es un detalle: **si conceder se siente igual de
espectacular que convertir, ganar deja de significar algo.**

| | Gol propio | Gol del rival |
|---|---|---|
| Flash | color del equipo, fuerte | gris, tenue |
| Screen shake | sí, 8 px | no |
| Entrada de la carta | rápida, con rebote | lenta, sin rebote |
| Tamaño de la carta | 100% | 70% |
| Texto | "¡GOL!" grande | "Gol de [nombre]" chico |

### Ticker inferior

Una línea de texto abajo de todo que va acumulando el relato completo:
`23' Tiro desviado de Martínez` · `31' ¡GOL de Álvarez!` · `44' Palo de Rodríguez`

Sirve para dos cosas: llena el silencio entre eventos, y le da al jugador algo que leer
si se distrajo.

---

## Fase 3 — Pitazo final (2.5 s)

- El reloj llega a 90' y se congela.
- Todo lo demás se desvanece.
- El marcador final crece al centro de la pantalla con un punch.
- Texto según resultado: "¡Ganaste!" / "Empate" / "Derrota".

---

## Fase 4 — Recompensas (~5 s)

Acá es donde se cierra el ciclo de dopamina. Los números **cuentan hacia arriba**, nunca
aparecen ya escritos — ver un contador subir es lo que genera la sensación de ganancia.

1. **Figura del partido** — la carta grande, con brillo, y sus estadísticas del partido
   (goles, asistencias)
2. **Monedas ganadas** — contador que sube desde 0 con un tick sonoro por cada incremento
3. **Progreso** — barra de nivel o de racha que avanza

### El gancho

Dos botones, con jerarquía visual clara:

- **"Revancha"** — grande, destacado, color primario. Vuelve a jugar contra el mismo rival.
- "Buscar otro rival" — secundario, más chico.

El botón de revancha es lo que convierte una derrota en otro partido en lugar de en
un cierre de la app.

---

## Sonido — el mayor retorno por menor esfuerzo

Si se agrega una sola cosa fuera de esta lista, que sea esto:

- **Murmullo de tribuna** en loop, con el volumen atado a la velocidad del reloj:
  cuando el reloj frena, el murmullo sube.
- **Explosión de gol** cuando entra.
- **Sonido seco** para el palo (el contraste con el murmullo que venía subiendo es todo el efecto).
- **Tick** por cada incremento del contador de monedas.

Son cuatro archivos de audio y un tween de volumen, y multiplica la sensación del partido.

---

## Detalles de implementación (Phaser)

- Una **cola de eventos** procesada de a uno. Cada animación llama a un callback
  `siguienteEvento()` al terminar. No usar `setTimeout` anidados.
- El reloj es un tween sobre una variable numérica con easing variable, no un contador
  con `setInterval`.
- `CardSprite.js` ya existe y se reutiliza tal cual para goleador, arquero y figura.
  Solo hace falta poder escalarlo.
- El **botón de saltear** corta la cola y va directo a la Fase 3. Siempre visible, pero
  discreto: los que quieren farmear van a saltear, y está perfecto que puedan.
- Después de ~10 partidos, ofrecer un toggle de **modo rápido (×2)**. La primera vez tiene
  que ser lenta y espectacular; la número cincuenta, no.

---

## Fuera del alcance

- Cancha 2D con jugadores moviéndose
- Repeticiones
- Comentarista con voz
- Animaciones distintas por tipo de gol (cabezazo, tiro libre, penal)
