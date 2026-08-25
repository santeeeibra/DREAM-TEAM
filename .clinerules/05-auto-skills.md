# Sistema Automático de Activación de Skills

## REGLA OBLIGATORIA: Detectar y activar skills automáticamente

Antes de comenzar CUALQUIER tarea, el agente DEBE:
1. Analizar las palabras clave del pedido del usuario
2. Identificar qué skills son relevantes
3. Activar automáticamente las skills correspondientes
4. Ejecutar la tarea con esas skills activas

---

## 📋 Mapeo Automático: Palabras Clave → Skills

### **Arquitectura y Motor del Juego**
**Palabras clave:** arquitectura, motor, engine, lógica, estado, simulación, temporada, once, plantel, cartas, sobres
**Skills a activar:**
- `dream-team-architecture` (SIEMPRE en tareas de código del juego)
- `dream-team-cards` (si toca UI, cartas, sobres, chips)
- `dream-team-events` (si toca eventos narrativos, decisiones, IA)

### **UI y Diseño Visual**
**Palabras clave:** pantalla, visual, diseño, CSS, layout, componente, botón, color, responsive, mobile
**Skills a activar:**
- `dream-team-cards` (UI del juego)
- `high-end-visual-design` (diseño profesional)
- `emil-design-eng` (ingeniería de diseño)

### **Revisión de Código**
**Palabras clave:** revisar, review, bug, error, optimizar, refactorizar, seguridad
**Skills a activar:**
- `review` (revisión general)
- `review-bugbot` (detección de bugs)
- `review-security` (vulnerabilidades)

### **Exploración y Búsqueda**
**Palabras clave:** buscar, encontrar, dónde está, explorar, analizar codebase, grafo
**Skills a activar:**
- `graphify` (SIEMPRE para explorar código)

### **Automatización y Scripting**
**Palabras clave:** automatizar, script, workflow, pipeline, CI/CD
**Skills a activar:**
- `automate`
- `shell`

### **Documentación y Reglas**
**Palabras clave:** documentar, regla, guía, convención, best practice
**Skills a activar:**
- `create-rule` (crear nueva regla)
- `onboard` (documentación de onboarding)

### **Skills y Subagentes**
**Palabras clave:** skill, subagent, crear skill, delegar tarea
**Skills a activar:**
- `create-skill` (crear nueva skill)
- `create-subagent` (crear subagente)
- `find-skills` (buscar skills disponibles)

### **Testing y Splits**
**Palabras clave:** test, testing, PR, pull request, split, dividir
**Skills a activar:**
- `split-to-prs` (dividir cambios en PRs)

### **Marketing y Copywriting**
**Palabras clave:** marketing, copy, texto promocional, landing, conversión
**Skills a activar:**
- `copywriting`
- `marketing-ideas`
- `marketing-plan`
- `cro` (optimización de conversión)

### **Canvas y Diagramas**
**Palabras clave:** diagrama, flujo, canvas, visual, arquitectura visual
**Skills a activar:**
- `canvas`

### **Migraciones**
**Palabras clave:** migrar, actualizar sistema, cambiar framework
**Skills a activar:**
- `migrate-to-skills`

---

## 🤖 Proceso Automático

### **Paso 1: Análisis del Pedido**
```
Usuario: "Quiero agregar una nueva pantalla de estadísticas al juego"

Detección:
- "pantalla" → UI
- "juego" → Dream Team
- Implicación: toca arquitectura + UI

Skills detectadas:
✓ dream-team-architecture
✓ dream-team-cards
```

### **Paso 2: Activación Automática**
```javascript
// El agente ejecuta internamente:
await activateSkill('dream-team-architecture');
await activateSkill('dream-team-cards');
```

### **Paso 3: Ejecución con Skills Activas**
El agente procede con la tarea siguiendo las reglas de las skills activadas.

---

## 📚 Reglas Especiales por Proyecto

### **Dream Team (este proyecto)**
**SIEMPRE activar:**
- `dream-team-architecture` — En TODA tarea de código
- `graphify` — Si necesita explorar el código

**Activar según contexto:**
- `dream-team-cards` — Si toca UI/pantallas/visual
- `dream-team-events` — Si toca eventos/narrativa/IA

### **Otros Proyectos**
**SIEMPRE activar:**
- `graphify` — Para explorar código nuevo

---

## 🎯 Ejemplos de Activación Automática

### Ejemplo 1: "Agregar pantallas de play-offs"
```
Detección:
- "pantallas" → UI
- Contexto: Dream Team

Skills activadas:
✓ dream-team-architecture
✓ dream-team-cards
✓ graphify (para explorar SeasonScene.js)
```

### Ejemplo 2: "Revisar el motor de simulación por bugs"
```
Detección:
- "revisar" → review
- "bugs" → bugbot
- "motor" → arquitectura

Skills activadas:
✓ dream-team-architecture
✓ review
✓ review-bugbot
```

### Ejemplo 3: "Crear un script para automatizar el deploy"
```
Detección:
- "script" → shell
- "automatizar" → automate

Skills activadas:
✓ automate
✓ shell
```

### Ejemplo 4: "¿Dónde está la lógica de eventos?"
```
Detección:
- "dónde está" → búsqueda
- "eventos" → dream-team-events

Skills activadas:
✓ graphify
✓ dream-team-architecture
✓ dream-team-events
```

---

## ⚠️ Casos Especiales

### **Multiple Skills Conflictivas**
Si dos skills tienen reglas contradictorias:
1. Priorizar skills específicas del proyecto (`dream-team-*`)
2. Luego skills de dominio (`high-end-visual-design`)
3. Finalmente skills generales (`review`)

### **Skills No Identificadas**
Si el pedido no matchea ninguna palabra clave:
- Activar `graphify` por defecto (para explorar)
- Si es código de Dream Team, activar `dream-team-architecture`

### **Usuario Solicita Skill Específica**
Si el usuario dice explícitamente "usa la skill X":
- Activar SOLO esa skill
- No activar otras automáticamente

---

## 📝 Logging de Skills

Al inicio de cada tarea, el agente DEBE declarar:
```
🎯 Skills activadas automáticamente:
✓ dream-team-architecture (código del juego)
✓ dream-team-cards (UI y pantallas)
✓ graphify (exploración de código)

Comenzando tarea...
```

---

## 🔄 Actualización de Mapeos

Cuando se agregue una nueva skill workspace:
1. Actualizar este archivo con palabras clave
2. Agregar ejemplos de uso
3. Definir prioridad vs otras skills

---

**Creado:** 2026-08-25  
**Propósito:** Automatizar la activación de skills según contexto de la tarea
