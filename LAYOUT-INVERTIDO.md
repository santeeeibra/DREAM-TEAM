# Layout Invertido de Alineación — Dream Team

## Cambio realizado: 2026-08-25

### Objetivo
Invertir el layout de la pantalla de alineación para que coincida con la perspectiva tradicional de juego:
- **Arriba:** Delanteros atacando hacia el arco rival
- **Abajo:** Arquero defendiendo el arco propio

### Antes (layout original)
```
┌─────────────────┐
│  ARQ (arriba)   │  ← Arquero propio arriba
│      DEF        │
│      MED        │
│  DEL (abajo)    │  ← Delanteros abajo
└─────────────────┘
```

### Después (layout invertido)
```
┌─────────────────┐
│  DEL (arriba)   │  ← Delanteros arriba atacando
│      MED        │
│      DEF        │
│  ARQ (abajo)    │  ← Arquero abajo defendiendo
└─────────────────┘
```

## Archivos modificados

### 1. `src/ui/main.js` — Líneas 594-605
**Cambio:** Invertir el orden de las líneas en `LINEAS_POR_FORMACION`

**Antes:**
```javascript
const LINEAS_POR_FORMACION = {
  '4-3-3':   [[0], [3,1,2,4],   [5,6,7],     [8,10,9]],  // ARQ → DEF → MED → DEL
  // ...
};
```

**Después:**
```javascript
const LINEAS_POR_FORMACION = {
  '4-3-3':   [[8,10,9],   [5,6,7],     [3,1,2,4],   [0]],  // DEL → MED → DEF → ARQ
  '4-4-2':   [[9,10],     [5,6,7,8],   [3,1,2,4],   [0]],
  '4-2-3-1': [[10],       [8,7,9],     [5,6],       [3,1,2,4],   [0]],
  '3-5-2':   [[9,10],     [7,4,5,6,8], [1,2,3],     [0]],
  '3-4-2-1': [[10],       [8,9],       [6,4,5,7],   [1,2,3],     [0]],
  '5-3-2':   [[9,10],     [6,7,8],     [4,1,2,3,5], [0]],
};
```

### 2. `src/ui/main.js` — Líneas 222-224 (renderSimModal)
**Cambio:** Ajustar posiciones Y de las fichas en la simulación visual de partidos

**Antes:**
```javascript
const MY_TOP = { POR: 88, DEF: 73, MED: 53, DEL: 33 };
const ZONA_TARGET = [88, 73, 53, 33, 10];
```

**Después:**
```javascript
// INVERTIDO: POR abajo (88%), DEL arriba (15%)
const MY_TOP = { POR: 88, DEF: 60, MED: 40, DEL: 15 };
const ZONA_TARGET = [88, 60, 40, 15, 5];
```

### 3. `src/ui/main.js` — Líneas 246-251 (rivalSpec en renderSimModal)
**Cambio:** Ajustar posiciones de las fichas rivales

**Antes:**
```javascript
const rivalSpec = [
  { pos: 'POR', top: 8, left: 50 },
  { pos: 'DEF', top: 20, left: 20 }, // ...
  { pos: 'MED', top: 38, left: 25 }, // ...
  { pos: 'DEL', top: 56, left: 35 }, // ...
];
```

**Después:**
```javascript
// INVERTIDO: rivales arriba (POR rival arriba, DEL rival abajo cerca de nuestro arquero)
const rivalSpec = [
  { pos: 'POR', top: 8, left: 50 },
  { pos: 'DEF', top: 23, left: 20 }, // ...
  { pos: 'MED', top: 48, left: 25 }, // ...
  { pos: 'DEL', top: 70, left: 35 }, // ...
];
```

### 4. `src/ui/main.js` — Líneas 305-307 (animarJugadaDinamica)
**Cambio:** Actualizar constantes de animación para que coincidan con el nuevo layout

**Antes:**
```javascript
const MY_TOP = { POR: 88, DEF: 73, MED: 53, DEL: 33 };
const ZONA_TARGET_TOP = [88, 73, 53, 33, 10];
```

**Después:**
```javascript
// INVERTIDO: POR abajo (88%), DEL arriba (10%)
const MY_TOP = { POR: 88, DEF: 60, MED: 40, DEL: 15 };
const ZONA_TARGET_TOP = [88, 60, 40, 15, 5];
```

## Impacto

### ✅ Pantallas afectadas
1. **Pantalla de Once Titular** (`once` view) — El campo visual ahora muestra:
   - Delanteros arriba
   - Mediocampistas en el medio
   - Defensores más abajo
   - Arquero al fondo (abajo)

2. **Simulación de Partidos** (modal de simulación) — Las fichas se posicionan correctamente:
   - Nuestros delanteros arriba (15% desde top)
   - Nuestro arquero abajo (88% desde top)
   - Rivales también invertidos (POR rival arriba al 8%, DEL rival abajo al 70%)

3. **Animaciones de jugadas** — Las transiciones de zona respetan el nuevo layout

### 🔄 Lógica NO afectada
- El motor de simulación (`src/engine/`) **no se toca** — sigue funcionando igual
- Los slots ARQ/DEF/MED/DEL mantienen su significado lógico
- Las penalidades fuera de posición siguen igual
- El auto-once sigue funcionando correctamente

## Testing recomendado

1. **Paso 1/2 — Draft inicial:** Verificar que las 3 sobres se abren y las cartas se ven bien
2. **Paso 2/2 — Once titular:** 
   - Verificar que el arquero aparece **abajo**
   - Verificar que los delanteros aparecen **arriba**
   - Probar drag & drop entre slots
   - Probar cambio de formación (todas las 6 formaciones)
3. **Simulación de tramo:** Verificar que las fichas se posicionan correctamente en el campo durante los partidos
4. **Mobile (375px):** Verificar que el layout invertido se ve bien en móvil

## Notas técnicas

- Las coordenadas Y están en porcentajes (`top: X%`) para responsive
- El índice `[0]` siempre es el arquero (ARQ) en `FORMACIONES_SLOTS`
- Los índices de los arrays `LINEAS_POR_FORMACION` se invierten pero los valores (índices de slots) no cambian
- La línea media del campo (círculo central en CSS) sigue centrada al 50%

---

**Autor:** Kiro  
**Fecha:** 2026-08-25  
**Commit:** (pendiente)
