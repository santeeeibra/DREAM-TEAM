# Brief para Claude Code — Dream Team

Tres cambios, en este orden. Los nombres de archivo son los que había en el proyecto;
si el árbol cambió, adaptá pero **respetá los contratos** (firmas y shapes de datos).

Reglas del proyecto que siguen vigentes:
- El engine es puro: sin DOM, sin Supabase, sin fetch.
- Los efectos numéricos salen SIEMPRE del catálogo local, nunca de la IA.
- Un solo camino de mutación de estado, con clamps.
- Todo lo aleatorio pasa por el RNG con seed. Misma seed = misma carrera.
- Cada cambio acá abajo tiene que quedar cubierto por el harness headless antes de dar por cerrado.

---

## A. Nuevo shape de evento: outcomes con probabilidad + efectos diferidos

### A.1 Shape

```js
{
  id: 'figura_tocada',
  familia: 'individual',            // individual | tactico | institucional | vestuario
  tags: ['individual'],             // el narrador solo interpola {figura}/{rival} si está el tag
  titulo: 'Llega tocado al clásico',
  texto: '{figura} sintió el aductor. El médico no se juega.',

  // Precondición. Recibe el contexto completo (plantel, fixture, estado).
  // Si devuelve false, el evento no entra en el sorteo.
  filtro: (ctx) => ctx.figura && ctx.energia < 55 && ctx.proximoTramo.dificultad >= 3,

  opciones: [
    {
      etiqueta: 'Que juegue igual',
      imagen: 'lesion',             // clave de categoría, NO una ruta
      outcomes: [
        {
          prob: (ctx) => 40 + Math.round(ctx.energia * 0.4),   // number | (ctx) => number
          chip: '+6 de fuerza este tramo',
          tono: 'bueno',                                        // bueno | malo | neutro
          efectos: { nivel: +6 },
        },
        {
          prob: 'resto',            // literal: completa hasta 100
          chip: 'Se rompe · 3 fechas afuera',
          tono: 'malo',
          efectos: { nivel: -2, moral: -5 },
          diferidos: [
            { enTramos: 0, baja: { quien: 'figura', tramos: 3 } },
            { enTramos: 2, efectos: { moral: -3 }, aviso: 'La hinchada todavía le cobra la lesión de {figura}.' },
          ],
        },
      ],
    },
    {
      etiqueta: 'Guardarlo',
      imagen: 'vestuario',
      outcomes: [
        { prob: 100, chip: '−4 de fuerza este tramo', tono: 'malo', efectos: { nivel: -4 } },
      ],
    },
  ],
}
```

Reglas duras:
- Una opción tiene entre 1 y 3 outcomes. Las `prob` resueltas deben sumar exactamente 100.
- `prob` como función se clampea a [5, 95] antes de normalizar. Nunca 0% ni 100% en un outcome dinámico:
  si es seguro, escribilo como `prob: 100` fijo.
- Una opción con un solo outcome de `prob: 100` es la "certeza aburrida". La UI muestra "seguro" en vez de "100%".
- `imagen` es una clave de categoría, no una ruta. Categorías válidas:
  `entrenamiento | vestuario | prensa | cancha | lesion | hinchada | dirigencia | mercado`.
  La UI resuelve `/img/eventos/{categoria}-{n}.webp` eligiendo `n` con el RNG. El engine no sabe de rutas.

### A.2 Resolución y determinismo

En el momento en que el jugador elige una opción:
1. Se resuelven las `prob` con el contexto actual.
2. **Exactamente una** llamada al RNG para sortear el outcome. Ni una más, ni una menos —
   si en algún branch no se llama, la carrera deja de ser reproducible.
3. Se aplican `efectos` por el camino de mutación único, con clamps.
4. Los `diferidos` se encolan; no se aplican ahora.

Test obligatorio en el harness: correr la misma seed dos veces y comparar el estado final
campo por campo. Tiene que dar idéntico.

### A.3 Diferidos

Estado nuevo en la carrera:

```js
c.pendientes = [
  { tramoAbs: 14, efectos: { moral: -3 }, aviso: 'texto ya interpolado', origen: 'figura_tocada' },
]
```

- `tramoAbs` es índice absoluto: `temporada * TRAMOS.length + tramo`. Así los diferidos cruzan
  el cierre de temporada sin romperse.
- Se aplican **al empezar** el tramo correspondiente, antes de simular, por el mismo camino de mutación.
- Excepción: los efectos sobre `nivel` que caigan en otra temporada se descartan (nivel se resetea
  al cerrar temporada; aplicarlos sería inconsistente). Loguearlo en el harness, no fallar.
- El `aviso` se muestra en la previa del tramo como una línea, no como un evento nuevo. Es feedback,
  no decisión.
- Los pendientes van al save de Supabase junto con `seed` y `rng_state`.

### A.4 Bajas por lesión

```js
c.bajas = { [cartaId]: tramoAbsDeAlta }
```

- `diferidos[].baja` con `enTramos: 0` es inmediata.
- Una carta con baja vigente **no puede** entrar al once y **no puede** ser elegida por el armado automático.
- La UI la muestra en el banco, atenuada, con el motivo y las fechas restantes. Nunca la esconde. (Ver C.3.)

### A.5 Catálogo

- Cada familia (`individual`, `tactico`, `institucional`, `vestuario`) necesita al menos 6 eventos con el shape nuevo.
- Se mantiene la regla de pacing: nunca dos eventos de la misma familia seguidos, y cada temporada toca
  al menos 3 de las 4 familias.
- Migrar los eventos viejos: los que tienen efectos determinísticos pasan a `outcomes: [{ prob: 100, ... }]`.
  No inventes probabilidades para eventos existentes sin criterio — si no hay un riesgo narrativo claro, dejalo seguro.
- Validador en el harness: para cada evento, cada opción, con 20 contextos sintéticos distintos,
  las `prob` resueltas suman 100 y ninguna opción queda sin outcomes.

---

## B. HUD legible

### B.1 Energía en vez de fatiga

- El engine **sigue guardando `fatiga`**. No hay migración de datos.
- La UI muestra `energia = 100 - fatiga`. Barra llena = bien, para las cuatro variables.
  Una sola regla mental en todo el HUD.
- Umbrales de color de energía: >60 verde, 35–60 ámbar, <35 rojo.

### B.2 Presión con tratamiento propio

No es un recurso, es un reloj de despido. 5 segmentos de 20. El quinto va con borde rojo permanente
(marcador de despido), aunque esté vacío. Nada de barra continua igual a las demás.

### B.3 La línea de fuerza real

Debajo de las barras, una línea con la cuenta desglosada:

```
Fuerza real 76.4 = 11 titular 80.4 · energía −5 · moral +1 · presión 0 · nivel 0
```

Para esto exportá desde el engine:

```js
export function desgloseFuerza(c) {
  return { once, energia, moral, presion, nivel, total };  // total ya redondeado a 1 decimal
}
```

**La simulación tiene que usar esta misma función.** Si la cuenta queda duplicada entre el sim y el HUD,
en dos commits divergen y el jugador ve un número que no es el que se juega.

### B.4 Deltas visibles

Cuando una decisión mueve una variable, animar el delta saliendo de la barra (`+4` flotando ~600ms,
verde/rojo según si mejora o empeora *esa* variable — ojo que en fatiga bajar es bueno).
Hoy el número cambia y el jugador no se entera de qué pagó.

Respetar `prefers-reduced-motion`: sin animación, el número cambia y listo.

---

## C. Fix del once

### C.1 Penalización graduada

Reemplazar el binario actual (`encaja()` → 0 o −6) por:

```js
export function penalidad(posCarta, slot) {}  // devuelve 0 | 2 | 6
```

- Misma posición → 0
- Posición vecina (misma línea o línea adyacente: MC↔MCO, LI↔LD, DFC↔MC defensivo, EI↔ED, ED↔DC) → 2
- Cualquier otra → 6
- Arquero: 6 en cualquier slot que no sea el suyo, y cualquier otro en el arco también 6. Sin excepciones.

Dejar el mapa de vecindades en un solo lugar (`data/posiciones.js`), no repartido entre engine y UI.

### C.2 El bug de "a veces no me deja agregarlo"

Revisar el handler del slot en la UI. Tres sospechosos, en orden:

1. **Swap no implementado.** Si la carta elegida ya está en el once en otro slot, el handler detecta
   duplicado y aborta sin feedback. Fix: intercambiar las dos cartas de slot. Es el caso más probable.
2. **Candidatos filtrados por compatibilidad.** Si la grilla esconde a los incompatibles, "no me deja"
   significa que la carta ni aparece. Fix: mostrar siempre a todos (ver C.3).
3. **Baja/lesión bloqueando en silencio.** Fix: mostrar el motivo (ver A.4).

En los tres casos el síntoma es idéntico —click sin respuesta— así que hay que reproducir primero:
agregá al smoke test de jsdom un caso que meta una carta del banco en un slot donde otra carta del once
ya está ubicada, y verificá que las dos quedan en el once (swap) y que el rating recalcula.

**Ninguna acción del once puede fallar en silencio.** Si algo se rechaza, hay motivo visible.

### C.3 Comunicar la baja de media

Al tocar un slot, cada carta candidata muestra `79 → 73` (rating real → rating en ese slot),
con el segundo número en ámbar si la penalidad es 2 y en rojo si es 6. Hoy muestra solo el final
y parece que la carta "se rompió".

Las cartas con baja por lesión aparecen igual, atenuadas, no seleccionables, con "Lesionado · 2 fechas".

---

## D. Desajuste de granularidad de posiciones (raíz de dos bugs)

Confirmado con capturas reales: Isak (DEL, 88 OVR) puesto en el slot DC aparece con 82 —le está
aplicando la penalización de −6 pese a ser su puesto natural. Y el "armado automático" pone a Burns
(MED) de arquero, con Steele (POR real) libre en el banco. Mismo origen: `cards.position_type` en la
base solo tiene 4 valores anchos (`POR, DEF, MED, DEL`), pero la cancha usa slots finos
(`ARQ, LI, LD, DFC, MC, MCO, EI, ED, DC`). Si la compatibilidad compara el puesto ancho contra el slot
fino por igualdad de string, nunca matchea y todo sale penalizado o mal filtrado.

### D.1 Mapeo puesto ancho → slots finos

```js
// data/posiciones.js
export const SLOTS_POR_PUESTO_ANCHO = {
  POR: ['ARQ'],
  DEF: ['LI', 'LD', 'DFC'],
  MED: ['MC', 'MCO'],
  DEL: ['EI', 'ED', 'DC'],
};
```

`penalidad(posCarta, slot)` (de C.1) usa esto como primer paso: si `slot` está en
`SLOTS_POR_PUESTO_ANCHO[posCarta]` → 0, sin más chequeos. Recién si no matchea se evalúa
vecindad de puesto ancho (2) u opuesto (6). Esto reemplaza cualquier comparación de string directa
entre puesto de carta y slot en el codebase — buscar todos los usos de `encaja()` / comparaciones
tipo `carta.pos === slot` y pasarlos por esta función.

### D.2 Auto-armado: el slot ARQ es exclusivo de POR

Regla dura, sin excepción: el slot `ARQ` solo puede llenarse con una carta de `position_type === 'POR'`.
Si no hay ninguna en el plantel (raro, pero posible en un plantel muy chico), el slot queda **vacío**
y la UI muestra un aviso explícito ("no tenés arquero disponible") — nunca se rellena en silencio con
otro puesto.

Para el resto de los slots, el orden de asignación del algoritmo greedy:
1. Asignar `ARQ` primero (regla de arriba).
2. Para cada slot restante, entre las cartas aún libres, preferir coincidencia exacta de
   `SLOTS_POR_PUESTO_ANCHO` antes que vecindad. Si hay más de una carta con coincidencia exacta,
   la de mayor rating.
3. Solo usar vecinos (penalidad 2) si no queda ninguna carta de coincidencia exacta libre.
4. Puesto opuesto (penalidad 6) es último recurso, solo si no alcanza el plantel para llenar los 11.

Test para el harness: plantel con al menos un POR real y un DEL real, correr auto-armado 20 veces
con seeds distintas, verificar que ARQ siempre es POR y que ningún DEL termina fuera de
`['EI','ED','DC']` mientras haya alternativa disponible.

---

## Orden de trabajo sugerido

1. D primero (es la raíz de C.1 y del bug de auto-armado; sin esto, C.1 se construye sobre datos rotos).
2. C.2 (el swap), con el smoke test que lo reproduce.
3. C.1 y C.3, ya usando el mapeo de D.
4. B (el HUD no depende de A).
5. A completo, con el validador de probabilidades y el test de determinismo por seed.

Al cerrar: correr el harness de 200 carreras, el smoke de jsdom y el audit de módulos huérfanos.
Reportá qué pasó con cada uno.
