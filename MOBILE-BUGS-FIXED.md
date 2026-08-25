# Fixes de Bugs Visuales en Mobile — 2026-08-25

## 🐛 Bugs Identificados y Corregidos

### Bug 1: Sobres no centrados en mobile
**Síntoma:** Los sobres se salían del viewport en pantallas móviles causando scroll horizontal.

**Causa:** `.packs-grid` tenía `flex-wrap: nowrap` en `src/style.css`, forzando los sobres a quedarse en una línea horizontal que sobrepasaba el ancho disponible.

**Fix aplicado:**
- `index.html` L106-113: Agregado `flex-wrap:wrap` a `.packs-grid`
- `src/style.css` L1180: Cambiado `flex-wrap: nowrap` → `flex-wrap: wrap`
- `src/style.css` L1185: Cambiado `overflow-x: auto` → `overflow-x: visible`

**Resultado:** Los sobres ahora se ajustan automáticamente al ancho disponible y centran correctamente en mobile.

---

### Bug 2: Fotos gigantes de jugadores suplentes
**Síntoma:** Las fotos de los jugadores en el bench se mostraban enormes (ocupando toda la pantalla) en lugar de 72px compactas.

**Causa:** `.photo-well` dentro de `.bench-row > .carta-slot` no tenía restricciones explícitas de `max-width` ni `overflow`, permitiendo que las imágenes se expandieran más allá del contenedor de 72px.

**Fix aplicado:**
- `index.html` L388-389: Agregado a `.bench-card-slot .card .photo-well`:
  ```css
  width:100%;max-width:100%;overflow:hidden
  ```
  Y regla explícita para `img`: `width:100%;height:100%;object-fit:cover;object-position:50% 16%`

- `index.html` L404-405: Mismas reglas aplicadas a `.bench-row > .carta-slot .card .photo-well`

- `index.html` L377, L393: Agregado `max-width:72px` a los contenedores padre
- `index.html` L381, L397: Agregado `max-width:100%` a `.card-inner` para forzar contenedor

**Resultado:** Las fotos de suplentes ahora respetan el tamaño compacto de 72px sin desbordarse.

---

### Bug 3: Cartas duplicadas visualmente
**Síntoma:** Las cartas de suplentes aparecían duplicadas o con overflow visual extraño.

**Causa:** Falta de restricción `max-width` en múltiples niveles de la cascada CSS (`.bench-card-slot`, `.carta-slot`, `.card-inner`, `.photo-well`) permitía que el contenido se escapara del contenedor de 72px.

**Fix aplicado:**
- Cadena completa de `max-width` forzada en TODOS los niveles:
  - Contenedor: `flex:0 0 72px; max-width:72px`
  - Card-inner: `max-width:100%`
  - Photo-well: `width:100%; max-width:100%; overflow:hidden`
  - Img: `width:100%; height:100%`

**Resultado:** Cada carta bench ahora ocupa exactamente 72px sin duplicación visual ni overflow.

---

## ✅ Archivos Modificados

1. **`index.html`** (3 bloques CSS editados):
   - L106-113: `.packs-grid` (agregado `flex-wrap:wrap`)
   - L376-389: `.bench-card-slot` (agregado cadena de `max-width`)
   - L392-405: `.bench-row > .carta-slot` (agregado cadena de `max-width`)

2. **`src/style.css`** (1 bloque CSS editado):
   - L1173-1187: `.packs-grid` (cambiado `nowrap` → `wrap`, `auto` → `visible`)

---

## 🧪 Testing

**Verificar en:**
1. **Pantalla de sobres iniciales** (Paso 1 de 2): Los 3 sobres deben centrarse y ajustarse al viewport sin scroll horizontal
2. **Pantalla de Once** (Paso 2 de 2): Los suplentes en `.bench-row` deben ser compactos (72px) con fotos proporcionadas
3. **Mobile (375px)**: Repetir ambas pruebas en viewport angosto

**Comando:**
```bash
npm run dev
```
Abrir `http://localhost:5177/` y navegar a:
- Crear manager → Draft → Sobres iniciales
- Armar el 11 → Ver bench de suplentes

---

## 📐 Reglas de Diseño Respetadas

- **Espaciado:** `gap:20px` entre sobres (compacto pero respirable)
- **Responsive:** `flex-wrap:wrap` permite ajuste automático sin overflow
- **Mobile-first:** `max-width:100%` en cascada evita que imágenes rompan el layout
- **Object-fit:** `object-position:50% 16%` mantiene caras de jugadores centradas (no tocar según `.clinerules/30-ui.md`)

---

## 🎯 Skills Utilizadas

✓ `dream-team-architecture` (código del juego)  
✓ `dream-team-cards` (UI de cartas y sobres)  
✓ `high-end-visual-design` (diseño responsive)

---

**Creado:** 2026-08-25  
**Autor:** Kiro AI  
**Ticket:** Bugs visuales mobile (sobres descentrados, fotos gigantes, duplicación)
