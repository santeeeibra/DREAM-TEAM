# Sistema de Play-offs para Liga Profesional Argentina

## 📋 Estado del Proyecto: FASE 2 COMPLETADA ✅

---

## ✅ FASE 1 COMPLETADA: Backend e Integración

### **1. Constantes** (`src/core/constants.js`) ✅
- `LIGAPRO_EQUIPOS_POR_ZONA = 15`
- `LIGAPRO_TOTAL_EQUIPOS = 30`
- `LIGAPRO_FASE_REGULAR_MATCHDAYS = 16`
- `LIGAPRO_CLASIFICADOS_POR_ZONA = 8`

### **2. Motor de Play-offs** (`src/engine/playoffsSimulator.js`) ✅
- `simularPartidoPlayoff()` - Partido de eliminación directa
- `simularFasePlayoffs()` - Ronda completa
- `simularPlayoffsCompletos()` - Toda la llave
- Localía al mejor posicionado (excepto final neutral)
- Penales con 60% ventaja al mejor

### **3. Motor de Zonas** (`src/engine/zonesTable.js`) ✅
- `asignarZonas()` - Divide 30 equipos en A/B
- `calcularTablaPorZona()` - Simula fase regular
- `obtenerClasificados()` - 8 mejores por zona

### **4. Liga Profesional** (`src/data/leagues.js`) ✅
- 30 clubes argentinos en 2 zonas
- `tienePlayoffs: true`, `faseRegularMatchdays: 16`

### **5. Orquestador** (`src/engine/seasonOrchestrator.js`) ✅
- `simularTemporadaConPlayoffs()` exportada
- Coordina: fase regular → clasificación → play-offs
- Retorna: `CAMPEON` | `ELIMINADO_PLAYOFFS` | `ELIMINADO_FASE_REGULAR`

---

## ✅ FASE 2 COMPLETADA: Pantallas UI + Lógica de Integración

### **6. SeasonScene.js - Integración Completa** ✅

**A. Detección de liga con play-offs (L254-257):**
```javascript
const ligaConfig = getLeagueById(manager.league_id);
this.tienePlayoffs = ligaConfig?.tienePlayoffs || false;
this.ligaConfig = ligaConfig;
```

**B. Pantalla inicial adaptada (L392-401):**
- Muestra información "Liga con play-offs • Clasifican 8 por zona"
- Botón detecta tipo de liga y llama al flujo correcto

**C. Función principal de simulación (L1088-1136):**
- `simularTemporadaConPlayoffsCompleta()` — Coordina todo el flujo
- Obtiene club y zona del manager
- Llama a `simularTemporadaConPlayoffs()` del backend
- Guarda resultado en `this.resultadoPlayoffs`
- Actualiza estado con resultados de fase regular
- Muestra tabla de zonas

**D. Pantallas de visualización:**
1. `mostrarTablaZonas(tablasZonas, zonaJugador, posicionJugador)` (L762-843)
2. `mostrarClasificacionOEliminacion(clasificado, posicion)` (L850-934)
3. `mostrarBracketPlayoffs(faseActual)` (L940-1019)
4. `mostrarCampeon()` (L1024-1063)

**E. Lógica de navegación implementada:**
1. `continuarDespuesDeTabla()` (L1144-1151) — Verifica clasificación
2. `iniciarPlayoffs()` (L1153-1162) — Inicia bracket de octavos
3. `mostrarFasePlayoffs(nombreFase)` (L1164-1177) — Muestra fase actual
4. `simularFasePlayoffs(nombreFase)` (L1179-1203) — Avanza por fases
5. `finalizarTemporadaSinPlayoffs()` (L1205-1246) — Cierre sin campeonato
6. `finalizarTemporadaConCampeonato()` (L1248-1289) — Cierre como campeón

**Importaciones agregadas (L33, L48):**
- `simularTemporadaConPlayoffs` desde `seasonOrchestrator.js`
- `getLeagueById` desde `leagues.js`

---

## 🔄 PENDIENTE: Persistencia y Formulario

### **7. Persistencia** (`data/seasonsRepo.js`)
- [ ] Guardar zona del equipo en tabla `seasons`
- [ ] Persistir resultados de play-offs (fase, rival eliminador)
- [ ] Marcar flag de campeón

### **8. Formulario de creación de DT**
- [ ] Agregar "Liga Profesional (Argentina)" al dropdown
- [ ] Selector de equipos por zona A/B

---

## 🎯 Flujo Implementado

**1. Inicio de temporada:**
- Detecta si es liga con play-offs
- Muestra información en pantalla inicial

**2. Simulación:**
- Usuario presiona "Jugar temporada"
- Se simula fase regular (16 fechas) + play-offs completos
- Se guarda resultado

**3. Tabla de zonas:**
- Muestra posiciones de la zona del jugador
- Resalta clasificados (verde) y jugador (dorado)
- Botón "Continuar"

**4. Clasificación/Eliminación:**
- Si clasificó (top 8): "¡Clasificaste!" → "Jugar Play-offs"
- Si eliminó (9-15): "Quedaste eliminado" → "Ver resumen"

**5. Play-offs (si clasificó):**
- Muestra bracket de Octavos
- Usuario simula fase → Muestra Cuartos
- Continúa: Semifinales → Final
- Si gana final: "¡CAMPEÓN!"
- Si pierde en cualquier fase: "Ver resumen"

**6. Cierre:**
- Guarda resumen de temporada
- Crea siguiente temporada
- Navega a CareerSummaryScene

---

## 📝 Arquitectura

✅ **Separación de capas:** Motor puro sin Phaser/Supabase  
✅ **Reutilización:** `simularJornada()` para todos los partidos  
✅ **Estado inmutable:** Sin mutaciones directas  
✅ **Patrón visual:** Colores y tipografía consistentes  
✅ **Flujo no bloqueante:** Pantallas intermedias con decisiones del usuario

---

## 🚀 Próximos Pasos

1. **Testing del flujo completo** — Probar con manager en Liga Profesional
2. **Agregar persistencia** — Guardar zona y resultados en DB
3. **Formulario de creación** — Selector de liga y equipos por zona
4. **Refinamiento visual** — Ajustar animaciones y transiciones

---

## 📊 Estadísticas del Código

**Archivos modificados:** 2  
- `src/scenes/SeasonScene.js`: +550 líneas (746 → 1296)
- `PLAYOFFS-PROGRESS.md`: Actualizado

**Funciones agregadas:** 10  
**Pantallas nuevas:** 4  
**Líneas de código total:** ~550 líneas

---

**Última actualización:** 2026-08-25 02:04 UTC  
**Estado:** Backend ✅ | UI ✅ | Lógica ✅ | Falta: Persistencia y formulario

