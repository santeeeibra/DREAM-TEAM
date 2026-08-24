# TRADUCTOR DE PEDIDOS — Sistema automático

Este archivo traduce pedidos en criollo a zonas técnicas del proyecto.
Cuando el usuario pida algo, **leer este archivo PRIMERO** para ubicar
archivos y reglas sin gastar tokens en búsquedas.

---

## 🎯 PALABRAS CLAVE → ZONA + ARCHIVOS + REGLAS

### Resultados de partidos / Sorpresas / Realismo

**Palabras clave:**
- "resultados", "partidos", "goleada", "empate", "ganar", "perder"
- "sorpresa", "impredecible", "realista", "arcade", "volatilidad"
- "crisis", "mal momento", "racha mala"

**Zona:** Simulación de temporada  
**Archivos:**
- `src/engine/seasonSimulator.js` (líneas 1-600)
- `src/engine/liga.js` (líneas 100-220)

**Reglas:** `.clinerules/10-arquitectura.md` → sección "Simulación de resultados"

**Qué toca:**
- Umbrales de crisis (moral, fatiga, presión)
- Multiplicadores de azar
- Distribución de goles (lambda de Poisson)
- Ventaja de localía

---

### Plata / Moral / Fatiga / Presión / Estado

**Palabras clave:**
- "plata", "guita", "money", "cash", "económico"
- "moral", "ánimo", "motivación", "plantel contento/triste"
- "fatiga", "cansancio", "desgaste", "fundido"
- "presión", "exigencia", "dirigencia", "expectativas"
- "rating delta", "efectivo", "ajuste"

**Zona:** Estado de carrera  
**Archivos:**
- `src/state/careerState.js` (líneas 1-300)
- `src/engine/state.js` (líneas 1-100)
- `src/engine/balance.js` (constantes MORAL_*, FATIGA_*, PRESSURE_*)

**Reglas:** `.clinerules/10-arquitectura.md` → sección "Estado"

**Qué toca:**
- Clamps (rangos mínimos/máximos)
- Función `applyEffects()` (único camino de mutación)
- Deltas de eventos
- Penalidades por presión

---

### Eventos narrativos / Decisiones / Opciones

**Palabras clave:**
- "evento", "aparece un", "me avisa", "me pregunta"
- "decisión", "opción", "elegir", "botón"
- "texto", "dice", "mensaje", "narrativa"
- "lesión", "conflicto", "sponsor", "prensa"
- "figura", "rival", "jugador destacado"

**Zona:** Eventos narrativos  
**Archivos:**
- `src/engine/catalogoEventos.js` (catálogo completo con filtros)
- `src/engine/narrador.js` (orquestación + validación)
- `src/engine/candidatosEvento.js` (filtrado por contexto)
- `api/evento.js` (llamada a GROQ para narrar)

**Reglas:** `.clinerules/20-eventos-ia.md` + `.clinerules/60-narrativa.md`

**Qué toca:**
- Agregar/modificar eventos en el catálogo
- Filtros condicionales (racha, posición, tramo)
- Labels de opciones
- Deltas de efectos (money, moral, fatiga, pressure, rating_efectivo)
- Tono y jerga del texto

---

### Pantallas / Cómo se ve / Visual / Layout

**Palabras clave:**
- "se ve", "no se ve", "aparece", "desaparece"
- "pantalla", "botón", "card", "chip", "panel"
- "brilla", "animación", "hover", "color"
- "mobile", "se rompe", "overflow", "scroll"
- "espacio", "margen", "padding", "gap"

**Zona:** UI y diseño  
**Archivos:**
- `src/ui/main.js` (todo el HTML/CSS inline, 1400+ líneas)
- Buscar por clase CSS (ej: `.decision-card`, `.pack-container`, `.btn`)

**Reglas:** `.clinerules/30-ui.md` + `.clinerules/35-diseno.md`

**Qué toca:**
- Classes CSS y sus reglas
- Espaciado (compacto: 8-12px entre relacionados, 16-20px entre secciones)
- Colores (variables --noche, --panel, --fluor, --led, etc.)
- Grid responsivo (minmax con 100% para evitar overflow)
- Media queries para mobile (max-width: 560px)

---

### Cartas / Sobres / Draft / Colección

**Palabras clave:**
- "carta", "jugador", "rating", "posición", "rareza"
- "sobre", "pack", "abrir", "draft"
- "oro", "bronce", "épica", "común"
- "revelar", "animación de sobre"
- "plantel", "banco", "11 titular"

**Zona:** Cartas y sobres  
**Archivos:**
- `src/engine/cartas.js` (generación + rarezas)
- `src/engine/sobresLocal.js` (lógica de sobres offline)
- `src/data/cardsRepo.js` (draft inicial desde Supabase)
- `src/packOpening/draftSquad.js` (draft con mínimos por posición)
- `src/ui/main.js` (búsqueda: `.pack-container`, `.card-reveal`)

**Reglas:** `.clinerules/30-ui.md` → sección "Cartas y sobres"

**Qué toca:**
- Multiplicadores de rareza (bronce/oro_comun/oro_unico/epica)
- Mínimos de draft (1 POR, 4 DEF, 3 MED, 3 DEL)
- Animación de reveal (55ms por carta)
- Penalidad fuera de posición (0/5/12)

---

### Once titular / Formación / Slots / Táctica

**Palabras clave:**
- "11", "once", "titular", "formación"
- "slot", "posición", "ARQ", "DEF", "MED", "DEL"
- "fuera de posición", "penalidad", "rating efectivo"
- "auto-armar", "mejor 11"

**Zona:** Armado del 11  
**Archivos:**
- `src/engine/once.js` (autoOnce, ratingOnce, penalidad)
- `src/data/posiciones.js` (FORMACION, penalidad por slot)
- `src/data/lineupsRepo.js` (persistencia en Supabase)

**Reglas:** `.clinerules/10-arquitectura.md` + `.clinerules/50-context-engineering.md` → sección DDD

**Qué toca:**
- Algoritmo húngaro (asignación óptima)
- Slot ARQ exclusivo para POR
- Penalidades: 0 (natural) / 5 (vecino) / 12 (fuera)
- Formaciones disponibles (4-3-3, 4-4-2, etc.)

---

### Temporada / Tramos / Jornadas / Liga

**Palabras clave:**
- "temporada", "tramo", "jornada", "fecha"
- "tabla", "posición", "puntos", "objetivo"
- "ascenso", "descenso", "campeón"
- "rival", "fixture", "calendario"

**Zona:** Orquestación de temporada  
**Archivos:**
- `src/engine/seasonOrchestrator.js` (coordina tramos + eventos)
- `src/engine/eventSlots.js` (cuándo cortan los eventos)
- `src/engine/leagueTable.js` (tabla de posiciones)
- `src/engine/rivals.js` (generación de rivales)

**Reglas:** `.clinerules/10-arquitectura.md` → sección "Temporada"

**Qué toca:**
- Tramos (típicamente 7 fechas + evento)
- Slots de eventos (jornadas 7, 14, 21, 28)
- Rivales (fuerza distribuida alrededor del rating del plantel)
- Posición objetivo por tier

---

### Performance / Lentitud / Optimización

**Palabras clave:**
- "tarda", "lento", "se cuelga", "freezea"
- "performance", "optimizar", "más rápido"
- "carga", "build time"

**Zona:** Optimización  
**Archivos:**
- `vite.config.js` (config de build)
- `src/ui/main.js` (render pesado)

**Reglas:** `.clinerules/40-debug.md`

---

### Debug / No anda / Error

**Palabras clave:**
- "no anda", "se rompió", "error", "bug"
- "undefined", "null", "NaN"

**Zona:** Debug  
**Reglas:** `.clinerules/40-debug.md`

**Proceso:**
1. Reproducir el bug primero
2. Leer el stack trace
3. Una hipótesis por vez
4. Fix más chico que resuelve

---

## 🤖 PROCESO AUTOMÁTICO (YO LO SIGO)

Cuando vos me pedís algo:

1. **Leo este archivo primero** para traducir tu pedido
2. **Identifico la zona** según palabras clave
3. **Leo MAPA-CODIGO.md** para ubicar las líneas exactas
4. **Leo la regla correspondiente** en `.clinerules/`
5. **Leo SOLO los archivos necesarios** (máximo 2-3)
6. **Te muestro el plan** en 3-5 bullets
7. **Esperás tu OK**
8. **Hago los cambios quirúrgicos**
9. **Actualizo la documentación** si agregamos algo nuevo

---

## ✅ VALIDACIÓN

Si tu pedido NO matchea ninguna palabra clave:
- Te pregunto UNA cosa concreta para ubicarlo
- Nunca asumo, siempre confirmo

---

## 📝 MANTENER ACTUALIZADO

Cada vez que agreguemos una feature nueva, la agrego automáticamente.

