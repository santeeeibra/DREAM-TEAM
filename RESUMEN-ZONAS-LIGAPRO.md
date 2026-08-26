# Resumen: Implementación de Zonas en Liga Profesional Argentina

**Fecha:** 2026-08-25  
**Objetivo:** Dividir LigaPro en 2 zonas de 15 equipos cada una, mostrando tablas separadas en UI.

---

## ✅ Cambios Realizados

### 1. **`src/engine/liga.js`** — Motor de liga zone-aware

#### `candidatosRivales(club, ligaConfig)` (L30-49)
- Ahora recibe `ligaConfig` como parámetro
- Para LigaPro (`tienePlayoffs: true`), filtra solo equipos de la misma zona del DT
- Retorna 14 rivales de la misma zona (15 equipos totales con el DT)

#### `crearLiga()` (L57-107)
- Detecta `esLigaPro` desde `ligaConfig.tienePlayoffs`
- Usa `ligaConfig.equiposPorZona` (15) en vez de `LIGA.EQUIPOS` (20)
- Guarda `liga.zona`, `liga.esLigaPro`, `liga.ligaConfig` en el objeto retornado
- Cada equipo tiene campo `zona` (A o B)
- **Fix crítico:** NO recorta equipos impares para LigaPro (15 equipos válidos)

#### `posiciones(liga)` (L245-256)
- Para LigaPro, filtra y retorna solo equipos de `liga.zona` (la zona del DT)
- Para ligas normales, retorna toda la tabla

#### `posicionesPorZona(liga)` (L259-279) — **NUEVA**
- Retorna objeto `{ 'A': [...], 'B': [...] }` con ambas zonas
- Usado por UI para renderizar las dos tablas

---

### 2. **`src/ui/main.js`** — Renderizado de dos tablas

#### Import (L6)
- Agregado `posicionesPorZona` al import desde `engine/index.js`

#### `tablaPosiciones()` (L1046-1107)
- Detecta `c.liga.esLigaPro`
- **LigaPro:** Renderiza dos tablas (Zona A + Zona B) con headers separados
  - Ambas zonas se muestran con el formato "ZONA A" / "ZONA B"
  - Zona del DT tiene color fluor (--fluor)
  - La otra zona tiene color humo (--humo)
  - Cada tabla muestra 15 equipos
- **Liga normal:** Una sola tabla como antes

---

### 3. **`src/data/leagues.js`** — Eliminación de entrada duplicada

#### Cambio (L132-175 eliminados)
- Había DOS entradas `id: 'ligapro'` en el array
- La primera (sin `tienePlayoffs`, sin campos `zona`) causaba que `getLeagueById()` retornara la incorrecta
- **Solución:** Eliminada la entrada vieja
- La entrada correcta (L206-247) tiene `tienePlayoffs: true`, `equiposPorZona: 15`, y todos los clubes con campo `zona: 'A'|'B'`

---

### 4. **`src/core/constants.js`** — Fix mapa de clásicos

#### Cambio (L43-58)
- El mapa `CLASICOS` referenciaba equipos que NO existen en `leagues.js` (Ferro, All Boys, Chacarita, etc.)
- **Solución:** Actualizado con clásicos reales disponibles:
  - River Plate ↔ Boca Juniors (inter-zona)
  - Gimnasia LP ↔ Estudiantes LP (inter-zona)
- **Nota:** Racing-Independiente y San Lorenzo-Huracán están en la misma zona, por lo que no funcionan como clásicos inter-zona

---

## 🧪 Verificación

### Test realizado (`test-ligapro.mjs`)
```
✓ Liga config: Liga Profesional - tienePlayoffs: true
✓ Equipos totales en config: 30
✓ Liga creada - esLigaPro: true
✓ Zona del DT: A
✓ Equipos en la liga: 15
✓ Fixture generado: 28 fechas
✓ Zonas presentes en liga.equipos: [ 'A' ]
✓ posiciones() retorna: 15 equipos
✓ posicionesPorZona() keys: [ 'A' ]
✓ Zona A tiene: 15 equipos
✓ Mi equipo en tabla: River Plate - posición: 1
```

### Build
```bash
npm run build
# ✓ built in 1.01s (sin errores)
```

---

## 🎯 Resultado

- ✅ LigaPro genera ligas de **15 equipos** (no 20)
- ✅ Todos los rivales son de la **misma zona** del DT
- ✅ `posiciones()` retorna solo equipos de mi zona
- ✅ `posicionesPorZona()` retorna ambas zonas (A y B)
- ✅ UI renderiza **dos tablas** separadas en LigaPro
- ✅ Tabla de mi zona tiene highlight visual (color fluor)
- ✅ Build sin errores

---

## 📝 Pendientes (fuera de scope)

1. **Fixture:** Actualmente genera 28 fechas (round-robin completo con 15 equipos). `seasonOrchestrator.js` debe limitar a 14 fechas para la fase regular.
2. **Play-offs:** La lógica de clasificación (top 8 de cada zona) y eliminación directa existe en `playoffsSimulator.js` pero no está integrada al flujo principal.
3. **Clásicos intra-zona:** Racing-Independiente y San Lorenzo-Huracán no pueden ser "clásicos inter-zona" porque están en la misma zona. Revisar si el sistema de clásicos debe soportar rivales de misma zona.

---

## 📂 Archivos Modificados

- `src/engine/liga.js` — Motor de liga zone-aware
- `src/ui/main.js` — Renderizado de dos tablas
- `src/data/leagues.js` — Eliminación de duplicado
- `src/core/constants.js` — Fix clásicos

**Total:** 4 archivos, ~150 líneas modificadas/agregadas
