# 03-engine-balance
Fuente de verdad: `src/engine/balance.js`.

## Rol
- Único lugar donde viven los números de balance. Lógica pura: no importa Phaser, Supabase ni DOM.
- Versionado: si cambiás algo, subí `BALANCE_VERSION` (hoy `'1.6.0'`) y volvé a correr el harness.
- Los deltas jamás los calcula ni devuelve la IA: salen de este módulo / catálogo local.

## Liga y carrera
- `LIGA` — 20 equipos, 38 fechas. `TRAMOS: [7, 7, 6, 6, 6, 6]` → 6 tramos = 6 puntos de decisión por temporada (suman 38).
- `CARRERA` — `TEMPORADAS: 8`, `PLANTEL_MAX: 18`, `TITULARES: 11`.

## Rangos y estado
- `RANGOS` — clamps duros; **todo** valor de estado se clampea acá y en ningún otro lado:
  - `money` [0, 999] · `moral` [0, 100] · `fatiga` [0, 100] · `presion` [0, 100] · `ratingDelta` [-8, 8] (modificador de temporada; se resetea al cerrarla).
- `ESTADO_INICIAL` — money 12, moral 60, fatiga 10, presion 25, ratingDelta 0.

## Fuerza de partido
- `FUERZA` — fuerza = rating del 11 + ajustes:
  - `PESO_MORAL` 0.06 → (moral − 50) · peso = ±3
  - `PESO_FATIGA` 0.05 → −fatiga · peso = 0..−5
  - `PESO_PRESION` 0.02 → 0..−2
  - `PESO_MOMENTUM` 0.5 → momentum ∈ [−3, 3] = ±1.5
  - `PENALIDAD_POSICION` — NATURAL 0 / VECINO 5 / FUERA 12. Criterio de "vecino" en `data/posiciones.js:penalidad()`. DFC es exclusivo de DEF (como ARQ de POR): ahí un MED/DEL cae directo a FUERA; LI/LD sí admiten MED como vecino.
  - `LOCALIA` 1.12 · `VISITA` 0.92 · `GOLES_BASE` 1.35 · `GOLES_ESCALA` 18 · `GOLES_ESCALA_INFERIOR` 12 — curva asimétrica: cuando un equipo es inferior (`fuerza < rival`) la escala cae a 12 (el débil decae más abrupto → menos milagros contra los grandes); el favorito usa la escala 18 (se aplica en `liga.js:goles()`).

## Deriva por tramo
- `TRAMO` — deriva pasiva, sin feedback multiplicativo (evita el "pozo gravitacional" de moral):
  - `FATIGA_POR_TRAMO` 4 · `FATIGA_HAZANA` 3 · `MORAL_DRIFT_A_50` 2 (tira 1 punto hacia 50, aditivo) · `INGRESO_NETO` 1 (sponsors − sueldos)
  - Impuesto por hazaña (v1.5.0): por cada partido del tramo con puntos (`res ≠ 'P'`) contra un rival de tier con `off > 0` (`FUERZA_POR_TIER`, i.e. `grande`) se suma `FATIGA_HAZANA` a la fatiga del tramo — robarle puntos a un grande cansa (lo suma `carrera.js:jugarTramo()`).
  - `MORAL_POR_RENDIMIENTO` 6 (±, escalado por ppp − 1.35)
  - `PRESION_POR_RENDIMIENTO` 7 (los malos resultados duelen más) · `PRESION_OBJETIVO_LEJOS` 6 · `PRESION_OBJETIVO_CERCA` −4.

## Temporada
- `TEMPORADA`:
  - `PREMIO_BASE` 0.9 → (21 − posición) · base · `DESCANSO_FATIGA` −42
  - Objetivo: `OBJETIVO_INICIAL` 12 (12° o mejor en la temp. 1), `OBJETIVO_APRIETE` 2 por temporada, `OBJETIVO_PISO` 2 (nunca menos que subcampeón)
  - `PRESION_OBJETIVO_FALLADO` 32 · `PRESION_OBJETIVO_CUMPLIDO` −15 · `MORAL_TITULO` 10 · `PRESION_EXPECTATIVA_POR_TEMPORADA` 2.0.
- `DESPIDO` — `PRESION: 80`. Llegar a 80 de presión = te echan.

## Escalada de la liga
- `ESCALADA_LIGA` — la liga se refuerza por temporada: `BASE` 66, `POR_TEMPORADA` 1.2, `CASTIGO_AL_LIDER` 2.0 (si terminaste top 5), `ALIVIO_AL_ULTIMO` −1.0 (si peleaste el descenso).

## Jerarquía de rivales (tiers)
- `TIER_LIGA` — poder real de cada club rival: los **60 clubes** de `leagues.js`
  (3 ligas × 20), keyeados por `club_id` estable (v1.6.0), no por nombre:
  `grande` (Top 6: pelea el título), `medio` (media tabla), `bajo` (candidato
  al descenso). Clubs no listados o sin liga (legacy): `TIER_LIGA_DEFAULT` =
  `medio`. `CLUBES_RIVALES` (`src/data/nombres.js`) es legacy: el motor ya no
  lo usa.
- `FUERZA_POR_TIER` — banda de fuerza por tier, desvío sobre la media de `ESCALADA_LIGA`: `grande` +7 · `medio` 0 · `bajo` −7, `sd` 2 en los tres. Las bandas están **separadas a propósito** (medido full season: un club `medio` gana la liga 0–0.5% de las temporadas, un `bajo` 0%). Antes TODOS los rivales sacaban de la misma `gauss(media, 5.5)` y un Brighton/Crystal Palace salía campeón en ~70% de las sims.
- Se aplica en `liga.js:crearLiga()`: los 19 rivales del DT son los OTROS
  clubes de su liga en `leagues.js` (sin liga → Premier como fallback);
  `fuerza = gauss(media + cfg.off, cfg.sd)` por club, clamp 54–90. La media
  escala igual para todos por temporada (`ESCALADA_LIGA`).

## Rarezas
- `RAREZAS` — rangos de rating, pesos y color (coinciden con `cards.rarity` en Supabase):
  - `bronce` [45, 73] peso 15 · `oro_comun` [74, 79] peso 35 · `oro_unico` [80, 84] peso 35 · `epica` [85, 99] peso 15.

## Sobres
- `SOBRES.INICIAL` — alimenta solo el **fallback offline** `sobresIniciales()`
  (`src/engine/sobresLocal.js`): 5 cartas × 3 sobres + bonus 1, para cuando no
  hay Supabase.
- **Draft inicial real** (el camino del onboarding): `openInitialPacks()`
  (`src/data/cardsRepo.js`) filtra `cards` activas por `league_id` de la liga
  del DT (`premier`/`laliga`/`seriea`) y descarta las que el manager ya tiene;
  `draftSquad()` (`src/packOpening/draftSquad.js`) arma **25 cartas** — mínimos
  2 POR / 6 DEF / 6 MED / 4 DEL (18) + 7 libres, ponderadas por banda
  (15% bronze · 15% silver · 45% gold · 25% special) — y `splitIntoPacks()` las
  corta en **5 sobres × 5**. Se guardan en `user_cards` ANTES de la animación.
  El 11 sale armable sin penalidad (2 arqueros de mínimo).
- `SOBRES.REFUERZO` — 3 cartas; `bonusPorPosicion`: ≤1 → 3, ≤4 → 2, ≤10 → 1, resto 0. Mejor posición final = mejor sobre.

## Progresión de jugadores
- `PROGRESION` — `JOVEN` 24 / `VETERANO` 31 años; `SUBIDA` [1, 3], `BAJADA` [1, 3], `MESETA` [−1, 1].

## Modo difícil
- `MODO` — `FACIL` / `DIFICIL`.
- `PRESION_DIFICIL` — en difícil, los efectos de presión de cada evento se reemplazan: si sube → +25 (crítico), si baja → −10 (alivio limitado); si el evento no tenía presión, se deduce del net de moral/ratingDelta.
- `EPICAS_DIFICIL` — `SIN_EPICAS_MOD` −5 (sin épicas en el XI no se alcanza el techo), `CON_EPICA_BONUS` +2 por épica, `MAX_EPICAS` 3.
- `DIFICULTAD` — `PROB_GRAVE_POR_TRAMO` 0.30 (un evento grave reemplaza al narrativo; solo en difícil; 0 en fácil).
- `PRESION_INICIAL_TIER` — presión inicial del DT en difícil por `club_id` de `leagues.js` (`man-city` 42 · `real-madrid` 42 · `barcelona` 40 · `liverpool` 40 · `juventus`/`inter` 38; medianos 16-28). Clubs no listados: `PRESION_INICIAL_DIFICIL_DEFAULT` 15 (arrancan tranquilos pero con techo de título muy bajo).
- `ESTILOS_CLUB` — por `club_id` de `leagues.js`: `goles_mod`, `concedidos_mod`, `presion_extra` (afectan la simulación en `liga.js` vía `getEstiloRival`). Las 3 ligas están cubiertas (60 clubes). Default implícito: `{ 0, 0, 1 }`. Quedó corregida la deriva vieja que apuntaba al roster Premier 2023 (typo `conceos_mod`, key inválida `Nott'm Forest`, Burnley/Sheffield/Luton que ya no juegan).

## Reglas importantes
- Fatiga y presión: **subir es malo**.
- Un único camino de mutación con clamps (`state.js` aplica `RANGOS`); nunca mutar estado a mano.
- Los números nunca van en el prompt ni los calcula la IA.
- Cambiar algo acá ⇒ subir `BALANCE_VERSION` + correr harness.
- `TIER_LIGA` debe cubrir los 60 clubes de `leagues.js`: el harness falla si un club de tier `bajo` sale campeón y tolera ≤1% de campeones `medio`.
