# Mejoras de UI en Pantalla de Decisiones

**Fecha:** 2026-08-25  
**Objetivo:** Mejorar la claridad y legibilidad de la toma de decisiones

---

## 🎯 Problemas Resueltos

### 1. Confusión en los efectos de Fatiga y Presión
**Antes:** Los chips mostraban "▲15 FATIGA" sin indicar si era bueno o malo.  
**Después:** Los chips usan texto descriptivo:
- **"Fatiga Sube 15"** (chip rojo = malo)
- **"Fatiga Baja 8"** (chip verde = bueno)

El color del chip indica claramente el impacto:
- 🟢 Verde = Beneficioso para el jugador
- 🔴 Rojo = Perjudicial para el jugador

### 2. Tipografía poco legible en labels de decisiones
**Antes:** Font genérico, 15px, font-weight 700 (muy bold)  
**Después:** Barlow (sans-serif limpia), 17px, font-weight 600, letter-spacing mejorado

### 3. Labels sin capitalización
**Antes:** "arrancar con lo puesto"  
**Después:** "Arrancar con lo puesto"

---

## 🛠️ Cambios Técnicos

### Archivo: `src/ui/main.js`

#### Nueva función helper (L129-132)
```javascript
const capitalize = (s) => {
  if (!s || typeof s !== 'string') return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
};
```

#### Función `chipEsperado()` actualizada (L736-748)
```javascript
function chipEsperado(k, v) {
  const r = Math.round(v * 10) / 10;
  if (Math.abs(r) < 0.05) return `<span class="chip">${ICONO[k]} ${NOMBRE_VAR[k]} ±0</span>`;
  const bueno = MALO_SI_SUBE.has(k) ? r < 0 : r > 0;
  const mag = Number.isInteger(r) ? Math.abs(r) : Math.abs(r).toFixed(1);
  
  // Etiqueta descriptiva: "Baja" vs "Sube" para variables donde subir es malo
  const etiqueta = MALO_SI_SUBE.has(k) 
    ? (r < 0 ? 'Baja' : 'Sube')
    : (r > 0 ? 'Sube' : 'Baja');
  
  return `<span class="chip ${bueno ? 'pos' : 'neg'}" title="Promedio esperado según probabilidad de cada resultado">${ICONO[k]} ${NOMBRE_VAR[k]} ${etiqueta} ${mag}</span>`;
}
```

#### Función `chipsFijos()` actualizada (L758-773)
Similar al anterior, usa etiquetas descriptivas en vez de símbolos.

#### Labels capitalizados (L1496, L1530)
```javascript
// Antes
<span class="decision-label">${esc(opLabel)}</span>

// Después
<span class="decision-label">${esc(capitalize(opLabel))}</span>
```

### Archivo: `index.html`

#### CSS actualizado (L600)
```css
/* Antes */
.decision-label{font-weight:700;font-size:15px;line-height:1.3;padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,.08)}

/* Después */
.decision-label{font-family:'Barlow',sans-serif;font-weight:600;font-size:17px;line-height:1.4;padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,.08);letter-spacing:0.01em}
```

---

## 📋 Ejemplos de Chips

### Variables donde subir es BUENO (Money, Moral, Rating)
- `💰 Plata Sube 5000` → 🟢 Verde
- `😊 Moral Sube 12` → 🟢 Verde
- `⭐ Nivel Baja 3` → 🔴 Rojo

### Variables donde subir es MALO (Fatiga, Presión)
- `🔋 Fatiga Sube 15` → 🔴 Rojo
- `🔥 Presión Sube 8` → 🔴 Rojo
- `🔋 Fatiga Baja 10` → 🟢 Verde
- `🔥 Presión Baja 5` → 🟢 Verde

---

## ✅ Testing Manual

**Verificar:**
1. Los chips de Fatiga/Presión muestran "Sube" o "Baja" claramente
2. El color del chip coincide con el impacto (verde = bueno, rojo = malo)
3. Los labels de las decisiones empiezan con mayúscula
4. La tipografía es legible en mobile y desktop
5. Los efectos garantizados también usan el nuevo formato

**Escenarios de prueba:**
- Evento con opción que sube fatiga → debe mostrar chip rojo "🔋 Fatiga Sube X"
- Evento con opción que baja presión → debe mostrar chip verde "🔥 Presión Baja X"
- Evento con efectos mixtos → cada chip debe tener el color correcto
- Label genérico tipo "arrancar con lo puesto" → debe verse "Arrancar con lo puesto"

---

## 📝 Documentación Actualizada

- `.clinerules/30-ui.md` → Sección "Legibilidad de las variables" actualizada con el nuevo sistema
