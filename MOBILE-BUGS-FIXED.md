# Fixes de Bugs Visuales en Mobile — 2026-08-25

## 🐛 Bugs Identificados y Corregidos

### Bug 1: Sobres apilados verticalmente en mobile (ACTUALIZADO)
**Síntoma:** Los sobres se apilaban verticalmente en lugar de mostrarse los 3 en fila horizontal.

**Causa:** `flex-wrap: wrap` en `.packs-grid` causaba que los sobres se apilaran en pantallas angostas.

**Fix aplicado:**
- `index.html` L106-120: Cambiado `flex-wrap:wrap` → `flex-wrap:nowrap` + `overflow-x:auto`
- Agregada media query para centrar en desktop (min-width:768px)
- `src/style.css` L1173-1187: Mismos cambios aplicados

**Resultado:** Los 3 sobres aparecen en fila horizontal con scroll suave en mobile, centrados en desktop.

---

### Bug 2: Scroll bloqueado en pantallas de decisión (NUEVO)
**Síntoma:** Al intentar hacer scroll en pantallas de decisión (eventos), el scroll se bloqueaba y empujaba hacia arriba, impidiendo ver la segunda opción.

**Causa:** `.evento-copa` tenía `overflow: hidden;` (L418) que bloqueaba el scroll natural del contenedor.

**Fix aplicado:**
- `index.html` L420-425: Removido `overflow: hidden;` de `.evento-copa`

**Resultado:** El scroll funciona correctamente, permitiendo ver ambas opciones de decisión en mobile.

---

### Bug 3: Fotos gigantes de jugadores suplentes (CORREGIDO ANTERIORMENTE)
**Síntoma:** Las fotos de los jugadores en el bench se mostraban enormes (ocupando toda la pantalla) en lugar de 72px compactas.

**Causa:** `.photo-well` dentro de `.bench-row > .carta-slot` no tenía restricciones explícitas de `max-width` ni `overflow`.

**Fix aplicado:**
- `index.html` L388-389: Agregado a `.bench-card-slot .card .photo-well`:
  ```css
  width:100%;max-width:100%;overflow:hidden
  ```
  Y regla explícita para `img`: `width:100%;height:100%;object-fit:cover;object-position:50% 16%`

- `index.html` L404-405: Mismas reglas aplicadas a `.bench-row > .carta-slot .card .photo-well`

- `index.html` L377, L393: Agregado `max-width:72px` a los contenedores padre
- `index.html` L381, L397: Agregado `max-width:100%` a `.card-inner`

**Resultado:** Las fotos de suplentes respetan el tamaño compacto de 72px sin desbordarse.

---

## ✅ Archivos Modificados

1. **`index.html`** (3 bloques CSS editados):
   - L106-120: `.packs-grid` (agregado `flex-wrap:nowrap` + `overflow-x:auto` + media query)
   - L420-425: `.evento-copa` (removido `overflow:hidden`)
   - L376-412: `.bench-card-slot` y `.bench-row > .carta-slot` (cadena `max-width` - cambio previo)

2. **`src/style.css`** (1 bloque CSS editado):
   - L1173-1187: `.packs-grid` (cambiado `wrap` → `nowrap`, agregado `-webkit-overflow-scrolling`)

---

## 🧪 Testing

**Verificar en mobile:**
1. **Pantalla de sobres iniciales** (Paso 1 de 2): Los 3 sobres deben aparecer en fila horizontal con scroll suave
2. **Pantalla de decisiones** (eventos): Debe permitir scroll para ver ambas opciones sin bloqueos
3. **Pantalla de Once** (Paso 2 de 2): Los suplentes deben ser compactos (72px) con fotos proporcionadas

**Desktop (>768px):**
- Los sobres deben centrarse automáticamente sin scroll

**Comando:**
```bash
npm run dev
```
Abrir `http://localhost:5177/` y navegar a:
- Crear manager → Draft → Sobres iniciales (verificar scroll horizontal)
- Jugar temporada → Decisión (verificar scroll vertical funciona)
- Armar el 11 → Ver bench de suplentes (verificar tamaño 72px)

---

## 📐 Cambios Técnicos

### Sobres (`.packs-grid`):
- **Mobile:** `flex-wrap:nowrap` + `overflow-x:auto` + `justify-content:flex-start`
- **Desktop:** Media query `@media (min-width:768px)` → `justify-content:center` + `overflow-x:visible`
- **Touch:** `-webkit-overflow-scrolling:touch` para scroll suave en iOS

### Decisiones (`.evento-copa`):
- **Removido:** `overflow:hidden` que bloqueaba scroll del viewport
- **Mantenido:** Animaciones y gradientes intactos

### Bench (`.bench-row`):
- **Sin cambios:** Fix previo de `max-width:72px` en cascada completa

---

## 🎯 Skills Utilizadas

✓ `dream-team-architecture` (código del juego)  
✓ `dream-team-cards` (UI de cartas y sobres)  
✓ `high-end-visual-design` (diseño responsive)

---

**Última actualización:** 2026-08-25  
**Commits:**
- `2d89572` — Fix inicial (fotos gigantes + duplicación)
- `[pending]` — Fix sobres horizontal + scroll decisiones

---

## 📝 Notas

- El `overflow:hidden` en `.evento-copa` probablemente se agregó para contener los gradientes de borde, pero bloqueaba el scroll del contenedor padre (#app)
- La solución de sobres horizontales con scroll es estándar en UX mobile (ej: historias de Instagram, carruseles de Netflix)
- En desktop, los 3 sobres caben sin scroll y se centran automáticamente gracias a la media query
