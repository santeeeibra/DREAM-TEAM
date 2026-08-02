# Dream Team — Motor de simulación de partido (Fase 3)

Especificación de lógica. **No es código todavía** — es el documento de diseño que define
qué tiene que hacer el motor antes de implementarlo.

Perfil elegido: **Arcade** (muchos goles) + **Equilibrado** (sorpresa cada tanto) + **stats derivadas por posición**.

---

## 0. Stats derivadas por posición

### El problema

En el pipeline de carga, `apply-approved.js` escribe el mismo valor de `calculateRating()`
en las 6 stats de la carta, porque `cards.overall_rating` es una columna GENERATED que
se calcula a partir de ellas.

Resultado: para los 200 jugadores reales, `shooting === passing === defense === overall`.
Un delantero de 82 defiende exactamente igual que un central de 82. Cualquier fórmula
que pese stats por separado colapsa a "usar solo el overall".

### La solución

Una función que reparte el overall según la posición, **en memoria, al cargar la carta**.
No se toca la base de datos.

| Posición | pace | shooting | passing | defense | physical | goalkeeping |
|---|---|---|---|---|---|---|
| **DEL** | +6 | +10 | −6 | −18 | +2 | — |
| **MED** | +2 | −2 | +10 | −2 | 0 | — |
| **DEF** | −2 | −14 | −6 | +12 | +6 | — |
| **ARQ** | — | — | — | — | +4 | = overall |

- Todos los valores con **clamp entre 30 y 99**.
- Es determinístico: el mismo jugador da siempre las mismas stats derivadas.
- El día que se consiga una fuente con passing accuracy real, se reemplaza esta función
  y el motor no se entera de nada.

---

## 1. Fuerzas por sector

De los 11 titulares de cada equipo salen 4 números en escala 0–100:

```
ATAQUE   = 0.55 · prom(shooting de los DEL)
         + 0.25 · prom(pace de los DEL)
         + 0.20 · prom(passing de los MED)

MEDIO    = 0.60 · prom(passing de los MED)
         + 0.25 · prom(physical de los MED)
         + 0.15 · prom(pace de los MED)

DEFENSA  = 0.60 · prom(defense de los DEF)
         + 0.25 · prom(physical de los DEF)
         + 0.15 · prom(defense de los MED)

ARQUERO  = goalkeeping del arquero
```

**Por qué se cruzan los sectores:** el ataque toma algo del mediocampo y la defensa también.
Esto premia armar un equipo equilibrado en lugar de meter 5 delanteros de 90 y dejar el
fondo vacío.

### Casos borde a contemplar
- Si una formación no tiene delanteros (ej. 5-5-0), usar los MED con mejor shooting como sustituto.
- Si falta el arquero, penalizar fuerte: `ARQUERO = 40`.

---

## 2. Posesión y volumen de ocasiones

**Principio de diseño clave: el mediocampo decide CUÁNTAS ocasiones tenés.
El ataque y la defensa deciden EN QUÉ TERMINAN.** Esa separación es lo que hace
que valga la pena invertir cartas en el mediocampo.

```
posesión_A = MEDIO_A / (MEDIO_A + MEDIO_B)
posesión_A = clamp(posesión_A, 0.35, 0.65)
posesión_B = 1 − posesión_A

ocasiones_totales = 18 + random_entero(0..6)      → entre 18 y 24

ocasiones_A = round(ocasiones_totales × posesión_A)
ocasiones_B = ocasiones_totales − ocasiones_A
```

El clamp en 0.35–0.65 evita que un mediocampo dominante deje al rival con 2 ocasiones.
Nadie quiere jugar un partido en el que no pateó nunca.

---

## 3. Resolución de cada ocasión

Para cada una de las ocasiones de un equipo:

### a) ¿Quién remata?

Sorteo ponderado entre los 11:

```
peso(jugador) = peso_posición × (shooting / 70)

peso_posición:  DEL = 6.0    MED = 2.5    DEF = 0.6    ARQ = 0
```

El 9 de 88 remata muchísimo, pero cada tanto el lateral clava una — y eso genera anécdota,
que es exactamente lo que hace que el jugador quiera contar el partido.

### b) ¿Quién asiste?

- 70% de las ocasiones tienen asistencia, 30% son jugada individual.
- Sorteo ponderado por `passing` entre MED y DEL, excluyendo al rematador.

### c) Calidad vs resistencia

```
Q = shooting_del_rematador × random_float(0.75 … 1.25)
R = 0.55 · DEFENSA_rival + 0.45 · ARQUERO_rival

p_gol = clamp( 0.28 × (Q / R)^1.3 , 0.06 , 0.70 )
```

**Las tres constantes y qué controla cada una:**

| Constante | Valor | Función |
|---|---|---|
| `0.75…1.25` | ±25% | El azar de "le pegó bien o le pegó mal" en esa jugada puntual |
| `0.28` | tasa base | Cuántos goles hay. Subirlo = más arcade. Con ~10 ocasiones da ~2.9 goles por equipo |
| `1.3` | exponente | Cuánto pesa el rating. Bajo a propósito: con marcadores altos el azar se promedia, así que hay que aflojar acá para conservar las sorpresas |

**Por qué se divide `Q/R` en lugar de restar:** la razón es inmune a la inflación de ratings.
Si mañana todas las cartas suben 10 puntos, el juego se sigue sintiendo igual. Con una resta,
habría que recalibrar todo.

### d) Si no es gol — tipo de fallo

| Resultado | Probabilidad | Notas |
|---|---|---|
| Atajada del arquero | 45% | Peso ajustado por el `goalkeeping` del arquero rival |
| Tiro afuera | 28% | |
| Bloqueo de defensor | 15% | Sortear qué DEF bloqueó, pesado por `defense` |
| **Palo / travesaño** | 12% | Oro dramático — reservado para la animación |

---

## 4. Minutos

- Cada ocasión recibe un `random_entero(1..90)`, sin repetir minutos.
- Ordenar todos los eventos (de ambos equipos) ascendente por minuto.
- **8% de probabilidad** de que la última ocasión se mueva al descuento (91–95).
  El gol agónico es lo que hace que el jugador apriete "revancha".

---

## 5. Salida del motor

El motor devuelve un objeto con:

- `marcador`: goles local / visitante
- `eventos[]`: lista ordenada por minuto, cada uno con
  `{ minuto, equipo, tipo, jugador, asistidor?, texto }`
- `estadísticas`: posesión %, remates, remates al arco, por equipo
- `figura`: jugador con más contribuciones de gol; en caso de empate, el de mayor overall
  del equipo ganador

**El marcador NO se calcula aparte y después se le inventa el relato.** El marcador
*sale* de contar los eventos tipo gol. Por eso cada gol tiene autor, minuto y asistencia
verdaderos, y nunca hay que forzar la narrativa para que cierre con el resultado.

---

## 6. Calibración — el paso que no se saltea

Antes de conectar el motor a cualquier escena visual, hay que escribir un script aparte
que corra **10.000 partidos simulados** y escupa esta tabla:

| Diferencia de overall | Victoria | Empate | Derrota |
|---|---|---|---|
| Iguales | ~40% | ~20% | ~40% |
| +5 | ~50% | ~19% | ~31% |
| +10 | ~60% | ~18% | ~22% |
| +15 | ~70% | ~15% | ~15% |

Y también: promedio de goles por partido (objetivo **~5.8 total**) y distribución de
marcadores más frecuentes.

**Si el mejor equipo gana el 90% de los partidos, no hay tensión y el juego aburre.
Si gana el 55%, la colección no sirve para nada y dejás de abrir sobres.**
El punto dulce está en que con un equipo claramente mejor igual perdés 1 de cada 5.

Se ajustan `0.28` y `1.3` hasta que los números den. Es media hora de trabajo que
ahorra semanas de "no sé por qué se siente raro".

---

## 7. Fuera del alcance del MVP

Dejar para después, para no frenar la Fase 3:

- Tarjetas amarillas y rojas (y jugar con 10)
- Lesiones
- Cambios durante el partido
- Química por club / liga / nacionalidad
- Ventaja de local
- Cansancio acumulado entre partidos
