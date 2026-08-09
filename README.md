# Dream Team — MVP del ciclo completo

Reinicio disciplinado. El loop entero está jugable: **crear DT → 3 sobres → armar 11 → 8 temporadas por tramos con eventos → resumen → sobre de refuerzo → fin de carrera (despido o contrato cumplido)**.

## Correr

```bash
npm install
npm run dev        # juego en localhost (Vite)
npm run sim        # harness headless: 200 carreras completas, reporte de balance
npm run audit      # detecta módulos huérfanos (código construido y nunca cableado)
node scripts/smoke-ui.js          # juega una carrera entera por la UI en jsdom
node scripts/build-standalone.js  # dist/dream-team.html (un solo archivo, sin servidor)
```

Sin `GROQ_API_KEY` el juego **anda igual**: cae al sorteo ponderado + texto del catálogo, y grita el problema en consola (nunca en silencio).

```bash
cp .env.example .env    # GROQ_API_KEY=...
```

## Cómo está armado (y por qué)

```
src/engine/     LÓGICA PURA — cero imports de Phaser, Supabase o DOM. Corre en Node.
  balance.js         todos los números, versionados (BALANCE_VERSION)
  state.js           ÚNICO camino de mutación, con clamps (§2.4)
  liga.js            fixture 38 fechas + simulación por tramos (§2.2)
  once.js            rating del 11 — SIEMPRE recalculado, nunca persistido (§2.5)
  cartas.js          sobres, rarezas, progresión por edad
  catalogoEventos.js 18 paquetes: efectos numéricos + texto de respaldo (§2.3)
  candidatosEvento.js  ÚNICO camino para obtener un evento (§3, antipatrón 1 y 3)
  narrador.js        prompt + validación estricta de la IA (sin fetch: testeable headless)
  carrera.js         orquestador / máquina de fases
src/ui/main.js  capa visual: sólo lee el motor, no calcula reglas
src/net/        fetch al proxy (impuro)
api/evento.js   proxy serverless de GROQ (la key nunca sale al front)
scripts/        harness, auditoría de huérfanos, smoke test de UI, build standalone
```

**El harness nació en el mismo commit que la lógica de estado** y ya pagó: la primera corrida dio 91.5% de despidos en 2.19 temporadas promedio. Tres iteraciones de calibración después:

| Política del bot | Despidos | Temporadas | Puesto prom. | Campeón ≥1 vez |
|---|---|---|---|---|
| Conservadora | 21.5% | 7.4 / 8 | 5.1° | 63% |
| Al azar | 56.5% | 6.6 / 8 | 6.5° | 54% |
| Agresiva | 63.5% | 6.3 / 8 | 7.0° | 50% |

Las decisiones mueven la aguja ~42 puntos de supervivencia: el juego se puede jugar mal.

## Ritmo

6 tramos por temporada × 8 temporadas = **48 puntos de decisión reales**, ~15 s cada uno → carrera completa en 10-15 min. Los partidos se resuelven matemáticamente por tramo; no hay relato minuto a minuto (descartado explícitamente).

## Eventos con IA

1. `candidatosEvento()` arma 5 candidatos filtrados por contexto (tramo, racha, moral, presión, plata, posición, historial).
2. Se le pasan a GROQ con sus trade-offs **en términos matemáticos**.
3. La IA **elige cuál narrar** y devuelve `{paqueteId, titulo, texto, opciones[{id,label}]}`.
4. `validarNarracion()` rechaza: id fuera de los candidatos, opciones faltantes, textos vacíos o pasados de largo.
5. Los efectos se leen **siempre** del catálogo por id. Si la IA manda números, se ignoran.
6. Falla o timeout (3.5 s) → sorteo ponderado + texto fijo. El jugador no se entera.
7. Cada opción muestra los íconos de consecuencia (💰 😊 🔋 🔥 ⭐) al lado del texto.

## Lo que queda para la fase 2 (fuera de este MVP, a propósito)

- **Persistencia Supabase**: la carrera es serializable salvo el objeto `rng` (guardar `rng.state` + seed alcanza para reanudar). Falta el esquema y el guardado por tramo.
- **Escenas Phaser**: hoy la capa visual es DOM. El motor no cambia cuando se migre; se reemplaza `src/ui/`.
- **Resumen narrativo de cierre de temporada con GROQ** (contrato ya diseñado, mismo proxy).
- **Dataset real de jugadores**: `src/data/nombres.js` genera el pool. El shape de carta (`{id,nombre,pos,rating,edad,rareza}`) ya es el real, así que cargar EA FC26 es reemplazar el generador, no tocar el motor.
- **n8n**: correr `npm run sim` + `npm run audit` en cada push y postear el reporte.
- Mercado de pases, copa nacional, química (descartada del MVP a propósito).

## Balance conocido a seguir mirando

- `moral` y `presion` todavía saturan sus topes bastante seguido en carreras largas (el harness lo reporta). No rompe nada, pero conviene revisar si las ganancias de moral deberían tener rendimientos decrecientes cerca de 100.
- `sponsor_polemico` aparece poco (filtro `money <= 10`): si querés que se vea más, aflojá el filtro.
