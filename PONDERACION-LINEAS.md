# Sistema de Ponderación por Líneas — Implementación

**Fecha:** 2026-08-25  
**Objetivo:** Diferenciar el impacto de cada línea (POR, DEF, MED, DEL) en ataque y defensa.

---

## 🎯 Cambios Implementados

### 1. **Nueva función en `once.js`**
- **`ratingPorLineas(once, plantel, formacion)`**: Devuelve `{ por, def, med, del }` con el rating promedio de cada línea.
- Usado por el simulador para ponderar ataque/defensa según la calidad de cada línea.

### 2. **Constantes de ponderación en `balance.js`**
```javascript
PESO_LINEAS_ATAQUE: {
  DEL: 0.50,  // Delanteros son los principales goleadores
  MED: 0.35,  // Mediocampistas crean juego y también anotan
  DEF: 0.10,  // Defensores ocasionalmente suben
  POR: 0.05,  // Arquero casi no influye en ataque
},
PESO_LINEAS_DEFENSA: {
  POR: 0.35,  // Arquero es crítico para evitar goles
  DEF: 0.45,  // Defensores son la primera barrera
  MED: 0.15,  // Mediocampistas marcan y cortan
  DEL: 0.05,  // Delanteros apenas defienden
}
```

### 3. **Funciones auxiliares en `seasonSimulator.js`**
- **`calcularFuerzaAtaque(lineas)`**: Suma ponderada de líneas para ataque.
- **`calcularFuerzaDefensa(lineas)`**: Suma ponderada de líneas para defensa.
- **`ratingALineas(rating)`**: Convierte un rating único en líneas con ruido ±2 (para rivales).

### 4. **Nueva firma de `simularJornada()`**
**Antes:**
```javascript
simularJornada(fuerzaLocal, fuerzaVisitante, estadoLocal)
```

**Ahora:**
```javascript
simularJornada(lineasLocal, lineasVisitante, ajusteEstadoLocal, ajusteEstadoVisitante, estadoLocal)
```

**Lógica:**
- **Goles del local** = `ataqueLocal` vs `defensaVisitante`
- **Goles del visitante** = `ataqueVisitante` vs `defensaLocal`
- Cada equipo tiene su propia diferencia ataque-defensa independiente.

### 5. **Integración en `simularTramo()`**
- Si `estado.lineasPlantel` existe, lo usa directamente.
- Si no (compatibilidad), convierte `ratingPlantel` a líneas uniformes con `ratingALineas()`.
- Los rivales generados también usan `ratingALineas()` con ruido ±2.

### 6. **Nueva función en `seasonsRepo.js`**
- **`lineasDelOnceTitular(managerId, seasonNumber)`**: Calcula líneas desglosadas desde la base de datos.
- Busca las cartas del 11 titular y llama a `ratingPorLineas()`.

### 7. **Actualización en `SeasonScene.js`**
- Calcula `lineasPlantel` al iniciar la temporada (junto a `ratingBase`).
- Lo agrega al estado inicial: `this.estado = { ratingBase, lineasPlantel, ... }`.

### 8. **Actualización en `seasonOrchestrator.js`**
- Pasa `lineasPlantel` desde el estado a `simularTramo()`.
- Compatibilidad con estados viejos: si no viene, el simulador lo genera al vuelo.

---

## 📊 Comportamiento Esperado

### **Ejemplo 1: Defensa débil**
- **Líneas:** POR 65, DEF 60, MED 75, DEL 80
- **Fuerza defensiva:** `65×0.35 + 60×0.45 + 75×0.15 + 80×0.05 = 65.75` (baja)
- **Resultado:** Más goles en contra, incluso con buen ataque.

### **Ejemplo 2: Ataque débil**
- **Líneas:** POR 80, DEF 75, MED 65, DEL 60
- **Fuerza ofensiva:** `60×0.50 + 65×0.35 + 75×0.10 + 80×0.05 = 64.75` (baja)
- **Resultado:** Menos goles a favor, incluso con buena defensa (0-0, 1-0 frecuentes).

### **Ejemplo 3: Equipo balanceado**
- **Líneas:** POR 72, DEF 70, MED 70, DEL 72
- **Fuerza ofensiva:** `72×0.50 + 70×0.35 + 70×0.10 + 72×0.05 = 71.1`
- **Fuerza defensiva:** `72×0.35 + 70×0.45 + 70×0.15 + 72×0.05 = 70.95`
- **Resultado:** Partidos parejos, marcadores realistas (1-1, 2-1, etc.).

---

## ✅ Ventajas del Sistema

1. **Realismo táctico:** Una defensa floja recibe más goles, un ataque flojo anota menos.
2. **Decisión estratégica:** El usuario debe balancear su plantel según su estilo de juego.
3. **Compatibilidad:** Estados viejos sin `lineasPlantel` siguen funcionando (fallback a distribución uniforme).
4. **Escalabilidad:** Fácil ajustar pesos si se necesita más/menos impacto de una línea.

---

## 🔧 Archivos Modificados

1. `src/engine/once.js` — Nueva función `ratingPorLineas()`
2. `src/engine/balance.js` — Constantes `PESO_LINEAS_ATAQUE` y `PESO_LINEAS_DEFENSA`
3. `src/engine/seasonSimulator.js` — Funciones de ponderación + nueva firma de `simularJornada()`
4. `src/data/seasonsRepo.js` — Nueva función `lineasDelOnceTitular()`
5. `src/scenes/SeasonScene.js` — Cálculo de `lineasPlantel` al iniciar temporada
6. `src/engine/seasonOrchestrator.js` — Pasar `lineasPlantel` a `simularTramo()`

---

**Próximos pasos:**
1. Verificar build sin errores
2. Testear simulación completa con líneas balanceadas/desbalanceadas
3. Ajustar pesos si los resultados no son realistas
