# Sistema de Play-offs para Liga Profesional Argentina

## 📋 Estado del Proyecto: FASE 2 EN PROGRESO ⚙️

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

## ⚙️ FASE 2 EN PROGRESO: Pantallas UI

### **6. Pantallas agregadas a `SeasonScene.js`** ✅

**Importaciones actualizadas (L33, L48):**
- `simularTemporadaConPlayoffs` desde `seasonOrchestrator.js`
- `getLeagueById` desde `leagues.js`

**Funciones de visualización:**

1. **`mostrarTablaZonas(tablasZonas, zonaJugador, posicionJugador)`** (L757-838)
   - Tabla de la zona del jugador
   - Clasificados en verde, jugador en dorado
   - Botón "Continuar"

2. **`mostrarClasificacionOEliminacion(clasificado, posicion)`** (L845-929)
   - Éxito: verde + "Jugar Play-offs"
   - Eliminado: rojo + "Ver resumen"

3. **`mostrarBracketPlayoffs(faseActual)`** (L935-1014)
   - Emparejamientos de la fase
   - Jugador resaltado en dorado
   - Resultados si ya se jugaron
   - Botón "Simular fase"

4. **`mostrarCampeon()`** (L1019-1058)
   - Pantalla "¡CAMPEÓN!" en dorado
   - Botón "Ver resumen"

**Stubs (L1064-1087):**
- `continuarDespuesDeTabla()`
- `iniciarPlayoffs()`
- `simularFasePlayoffs(nombreFase)`
- `finalizarTemporadaSinPlayoffs()`
- `finalizarTemporadaConCampeonato()`

---

## 🔄 PENDIENTE: Lógica de Integración

### **6. Implementar stubs en `SeasonScene.js`**
- [ ] Detectar liga con play-offs en `cargarDatosYArrancar()`
- [ ] Integrar `simularTemporadaConPlayoffs()` en el flujo
- [ ] Implementar `continuarDespuesDeTabla()` con datos reales
- [ ] Implementar `iniciarPlayoffs()` para mostrar bracket
- [ ] Implementar `simularFasePlayoffs()` con avance por rondas
- [ ] Implementar cierre de temporada con/sin campeonato

### **7. Persistencia** (`data/seasonsRepo.js`)
- [ ] Guardar zona del equipo
- [ ] Persistir resultados de play-offs
- [ ] Marcar campeón

### **8. Formulario de creación**
- [ ] Agregar "Liga Profesional (Argentina)" al dropdown
- [ ] Selector de equipos por zona

---

## 🎯 Formato Implementado

**Fase Regular:** 2 zonas de 15 equipos, 14 partidos cada uno (16 fechas)  
**Play-offs:** Octavos (16→8) → Cuartos (8→4) → Semis (4→2) → Final (2→1)  
**Final:** Cancha neutral sin ventaja de localía

---

## 📝 Arquitectura

✅ **Separación de capas:** Motor puro sin Phaser/Supabase  
✅ **Reutilización:** `simularJornada()` para todos los partidos  
✅ **Estado inmutable:** Sin mutaciones directas  
✅ **Patrón visual:** Colores y tipografía consistentes con el juego

---

## 🚀 Próximos Pasos

1. Implementar lógica de los stubs
2. Conectar con backend de play-offs
3. Agregar persistencia
4. Testing del flujo completo

---

**Última actualización:** 2026-08-25 01:58 UTC  
**Estado:** Backend ✅ | UI Pantallas ✅ | Falta lógica de integración
