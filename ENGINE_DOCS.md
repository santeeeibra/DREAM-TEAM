# ENGINE_DOCS.md — Dream Team: Motor de Carrera

> Documento maestro de arquitectura. Leé esto antes de tocar cualquier
> archivo de `src/engine/` o `src/state/`. Si algo en el código contradice
> este documento, el código está mal o este documento quedó desactualizado
> — avisar antes de asumir cuál de los dos manda.

---

## 1. Topología del motor

El motor de carrera está dividido en **dos sistemas con responsabilidades
disjuntas**, separados por la unidad de tiempo que gobiernan:

| Sistema | Archivo | Gobierna | Granularidad |
|---|---|---|---|
| **Simulación de tramo** | `src/engine/seasonSimulator.js` | `moral`, `fatiga` | Partido a partido, DENTRO de un tramo |
| **Estado de carrera** | `src/state/careerState.js` | `money`, `pressure`, `streak`, `ratingDelta` | Entre tramos / al resolver un evento |
| **Orquestador** | `src/engine/seasonOrchestrator.js` | Coordina a los dos anteriores | Por tramo (corta en los matchdays de `eventSlots.js`) |

**Regla dura de propiedad de estado:** `seasonSimulator.js` es el ÚNICO
lugar que modifica `moral` y `fatiga` mientras un tramo está corriendo.
`careerState.js` es el ÚNICO lugar que modifica `money`, `pressure`,
`streak` y `ratingDelta`, y es el único que toca `moral`/`fatiga` **entre**
tramos (vía `syncMoraleFatigaDesdeTramo`, que sincroniza los valores reales
que trajo el simulador — nunca los recalcula).

Un mismo archivo no debe implementar dos veces la misma lógica de
mutación de estado. Si necesitás que un evento entre tramos afecte moral,
eso pasa por `careerState.applyEffects()`, no por lógica nueva en
`seasonOrchestrator.js` ni en las escenas de Phaser.

`seasonOrchestrator.js` es **100% función pura**, sin dependencias de
Phaser/Supabase. Expone dos funciones:

- `simularHastaProximoEvento({estado, rivalesFuerza, eventosDisponibles})`
- `aplicarDecisionYContinuar({estado, decisionElegida, rivalesFuerza, eventosDisponibles})`

Ambas devuelven `{status: 'EVENT_TRIGGERED' | 'SEASON_COMPLETE', eventDetails?, estado, tramoStats}`.

`SeasonScene.js` (Phaser) mantiene el objeto `estado` entre llamadas y se
lo devuelve al orquestador en cada invocación — no hay un singleton nuevo
del lado de la escena. El orquestador también es el único punto que
llama a `careerState.syncStreakFromResultados()`, justo después de cerrar
un tramo, para ambas ramas (evento disparado o temporada completa).

---

## 2. Core Loop — fórmula de fuerza

Cada partido, dentro de `seasonSimulator.js`, la fuerza efectiva de un
equipo se calcula así:

```
fuerza = rating + (moral / 10) - (fatiga / 10) + azar
```

- `rating`: viene del 11 titular (`ratingBase` inmutable dentro del
  tramo — el progreso de carrera real, no cambia partido a partido).
- `moral` y `fatiga`: rango `[0, 100]`, mutadas fecha a fecha por este
  mismo motor (ver §3).
- `azar`: componente aleatorio del motor, resuelto por ocasión — el
  diseño evita calcular el resultado final antes de generar los eventos
  narrativos (resolución por ocasión individual, no "tirar el resultado
  y después inventar el relato").

**No usar subtracción directa contra el rival para inflar/deflactar.**
El diseño usa formato ratio-based (Q/R) en las partes del motor que
comparan fuerzas de dos equipos, específicamente para tener inmunidad a
inflación de rating cuando se agregan más ligas/jugadores más adelante
(Fase 6).

---

## 3. Gestión de Estado — clamps y mecanismos anti-loop

Esta sección documenta los tres mecanismos que existen específicamente
para evitar retroalimentación sin freno (feedback loops) en el sistema.
**Los tres nacieron de bugs reales de balance, no de diseño preventivo —
no borrar ninguno sin volver a correr el harness de 50 carreras antes/después.**

### 3.1 Reversión a la media de moral (dentro del tramo)

**Archivo:** `seasonSimulator.js`
**Por qué existe:** sin esto, moral se actualiza partido a partido de
forma puramente aditiva. Esto generaba un "pozo gravitacional": la fuerza
depende de moral, moral baja hace más probable perder, perder baja más
la moral. Medido empíricamente (harness, seed=7, 50 carreras): 53% de
las carreras terminaban con moral final <30, y de esas, 58% cruzaban ese
umbral (~fecha 14 promedio) y nunca más se recuperaban ("piso pegado").
Win rate en moral <30 caía a 27.9% (vs. 41.8% en moral 40–60), lo cual
retroalimentaba el pozo en vez de romperlo.

**Fórmula**, aplicada cada fecha, después del delta de resultado y antes
del clamp final:

```
moralCruda = moralAntes + deltaResultado
moralConReversion = moralCruda + (50 - moralCruda) * k
moralDespues = clamp(moralConReversion, 0, 100)
```

**k = 0.15** (default de producción, elegido empíricamente comparando
k=0.05/0.10/0.15 contra el baseline sin reversión).

Este mecanismo actúa **todas las fechas, gane o pierda el equipo** — a
diferencia de un parche que solo reaccione ante un evento raro (ej. "bonus
underdog" al ganar estando en el piso), la reversión empuja hacia el
centro de forma continua y proporcional a la distancia del centro, lo
cual ataca el loop en su origen en vez de esperar a que se rompa solo.

### 3.2 Bonus de racha con joroba (entre tramos)

**Archivo:** `careerState.js`, dentro de `getEffectiveRating()`
**Por qué existe:** el bonus de racha original era un escalón fijo sin
decaimiento (`+3` si `streak>=3`, `+1` si `streak>=1`, simétrico en
negativo) — una racha de 3 y una de 15 daban el mismo bonus, persistente
mientras la racha se mantuviera. Esto también retroalimentaba: racha
larga → bonus fijo → más probable extender la racha.

**Curva** (magnitud según `Math.abs(streak)`, signo según `Math.sign(streak)`):

| `|streak|` | bonus |
|---|---|
| 0 | 0 |
| 1–2 | ±1 |
| **3–5** | **±3** ← pico |
| 6–8 | ±2 |
| 9+ | ±1 |

**Nota de calibración (03/08/2026):** medido con instrumentación
(`DEBUG_RATING`), este componente resultó ser el que MENOS contribuye a
la polarización real (0/21 casos donde domina el clamp global, ver §3.3)
— el driver dominante era el pozo de moral (§3.1), no la racha. La joroba
se mantiene porque es la solución correcta en su propio dominio, pero no
esperar que por sí sola resuelva desvíos grandes en posición final.

### 3.3 Clamp global de rating efectivo (entre tramos)

**Archivo:** `careerState.js`, dentro de `getEffectiveRating()`

```
combo = bonusRacha + penalizacionPressure + ratingDelta
comboClampeado = clamp(combo, -8, +8)
ratingEfectivo = ratingBase + comboClampeado
```

- `penalizacionPressure`: `-2` si `pressure > 70`, `-4` si `pressure > 90`.
- `ratingDelta`: 5to estado de `careerState.js`, representa el "estado de
  gracia o crisis" TEMPORAL de la temporada en curso (distinto de
  `ratingBase`, que es el progreso de carrera real e inmutable dentro de
  la temporada). Tiene su propio clamp interno a `[-8, +8]` dentro de
  `applyEffects()`, se resetea a 0 exclusivamente cuando el orquestador
  devuelve `SEASON_COMPLETE` (`resetRatingDeltaTemporada()`). Es, en la
  práctica, el componente que más pesa dentro del clamp combinado
  (medido: domina en 15/21 de los casos donde el clamp recorta algo).

**`getEffectiveRating()` nunca persiste su resultado** — se recalcula
siempre a partir de los estados base. `ratingBase` sí es lo que progresa
la carrera real (evolución de plantel entre temporadas).

### 3.4 Otros clamps de estado (`applyEffects`, único camino de mutación)

Todo cambio a `money`/`pressure`/`streak`/`ratingDelta` pasa por
`careerState.applyEffects(deltas)`, que aplica estos clamps:

| Variable | Rango |
|---|---|
| `morale` | `[0, 100]` |
| `fatigue` | `[0, 100]` |
| `pressure` | `[0, 100]` |
| `streak` | `[-38, 38]` |
| `ratingDelta` | `[-8, +8]` |
| `money` | piso `0`, sin techo |

No mutar estas variables por fuera de `applyEffects()` — es el único
lugar con los clamps correctos, y duplicar la lógica en otro archivo es
como nació el bug de moral pisada del §5.5 (ver histórico de sesión
03/08/2026: `aplicarDecisionYContinuar` aplicaba deltas de evento sobre
`careerState.morale/fatigue` sin sincronizar antes con los valores reales
que traía `estado` del tramo — fixeado con `syncMoraleFatigaDesdeTramo`).

---

## 4. Reset entre temporadas

Al cerrar una temporada (`SEASON_COMPLETE`), antes de arrancar la
siguiente:

| Variable | Comportamiento |
|---|---|
| `money` | NO resetea — se acumula toda la carrera |
| `pressure` | Regresión al 50%: `nueva = (actual + 50) / 2` |
| `morale` | Regresión al 60%: `nueva = (actual + 60) / 2` |
| `streak` | Resetea a `0` |
| `fatigue` | Resetea a `0` |
| `ratingDelta` | Resetea a `0` (`resetRatingDeltaTemporada()`) |

---

## 5. Reglas inmutables (no renegociables sin discusión explícita)

1. **La IA (Gemini/Groq) nunca decide números.** Todo modificador
   (`money`/`moral`/`fatiga`/`presión`/`racha`) sale de rangos fijos en
   `events_catalog.options` (JSONB, balanceable sin programar). La IA
   solo redacta texto narrativo o prioriza qué evento mostrar según
   `careerState` — nunca inventa ni ajusta un modificador.
2. **Química/sinergia club-liga-país está 100% fuera del MVP.** No
   agregar bonus de este tipo a `getEffectiveRating()` sin decisión
   explícita — es scope de un modo de juego separado a futuro.
3. **No hay motor gol-a-gol relatado en vivo.** Se eliminó
   deliberadamente (`matchEngine.js`, `MatchScene.js` quedaron muertos,
   recuperables del commit `9fc29d2` si se retoma un modo "partido en
   vivo" aparte). El motor actual resuelve la temporada completa (38
   fechas) en segundo plano vía `seasonSimulator.js`, sin relato minuto
   a minuto, para respetar el límite de ~10-15 min por ciclo de carrera
   completo (8 temporadas).
4. **Cualquier cambio a un clamp o mecanismo de esta sección 3 requiere
   correr el harness (`scripts/simulate-career.js --carreras=50`)
   antes y después**, comparando como mínimo: posición final promedio,
   moral final promedio, % de carreras con título, y desvío estándar de
   posición final. Un cambio que no mueve el desvío estándar en la
   dirección esperada no está resolviendo el problema real, aunque
   "suene" correcto en el diseño — ver histórico del 03/08/2026, donde
   la primera hipótesis (racha) resultó ser secundaria y la real (moral)
   se encontró recién con instrumentación.

---

## 6. Dónde mirar si algo "se siente raro"

- **Carreras que se hunden y no se recuperan** → revisar §3.1 primero
  (moral), no §3.2 (racha) — la racha ya se descartó como driver
  dominante el 03/08/2026.
- **Ratings de carta fuera de 65–92** → no es este documento, ver
  `scripts/seed-players.js` (ancla fija `REFERENCE_MAX_POINTS_PER_GAME`)
  y `src/shared/ratingTiers.js`.
- **Formaciones/posiciones del 11** → `src/engine/formations.js`
  (reemplazó el `FORMATIONS` que vivía en el `matchEngine.js` muerto).
- **Slots de eventos narrativos fijos** → `src/engine/eventSlots.js`
  (`PRETEMPORADA=1`, `ARRANQUE=8`, `ECUADOR=19`, `RECTA_FINAL=30`,
  `CIERRE=38`; 3–5 de esos 5 se sortean una vez por temporada).

---

*Última actualización de contenido: sesión del 03/08/2026 (fix de
reversión a la media de moral, k=0.15).*
