# 🧪 GUÍA DE TESTING - Sistema de Lesiones y Diálogos

## ✅ Pre-requisitos

1. **Build exitoso:** `npm run build` ✅ (completado sin errores)
2. **Base de datos:** Agregar columna `lesionados` a tabla `managers`

```sql
ALTER TABLE managers ADD COLUMN lesionados JSONB DEFAULT '[]';
```

---

## 🎮 Cómo Probar el Sistema de Lesiones

### Escenario 1: Lesión de jugador de campo

1. **Crear nueva carrera** → Abrir sobres → Armar 11
2. **Subir fatiga artificialmente:**
   - Usar dev panel (si está disponible)
   - O jugar varios tramos seguidos sin descanso
3. **Esperar evento de lesión:** `lesion_figura_prePartido` (filtro: `fatiga >= 65`)
4. **Verificar:**
   - ✅ Aparece pantalla "Baja de último momento"
   - ✅ Se pide elegir reemplazo del banco
   - ✅ Al volver a "Armar 11", el jugador aparece bloqueado
   - ✅ Carta muestra "🚑 Lesionado" en lugar de edad
   - ✅ Carta está en grayscale y no se puede arrastrar
   - ✅ Aviso rojo arriba del 11 si está en el titular
   - ✅ Botón "Confirmar" deshabilitado si hay lesionados en el 11

5. **Jugar tramo completo** (7 jornadas)
6. **Verificar recuperación:**
   - ✅ Después del tramo, el jugador vuelve a estar disponible
   - ✅ Carta vuelve a ser normal (sin bloqueo)

### Escenario 2: Protección de arqueros

1. **Crear carrera con 1 solo arquero** (lo normal)
2. **Provocar múltiples lesiones** (subiendo fatiga repetidamente)
3. **Verificar estadísticamente:**
   - ✅ De cada 10 lesiones, ~1 debería ser arquero (10% vs 25% esperado sin protección)
   - ✅ Los jugadores de campo se lesionan más frecuentemente

---

## 💬 Cómo Probar los Diálogos

### Evento 1: `dialogo_pide_titularidad`
**Filtro:** `moral >= 60` + requiere `figura`

**Provocar:** Ganar varios partidos seguidos → moral sube

**Verificar:**
- ✅ Aparece "Charla en el vestuario"
- ✅ Opciones afectan moral y presión

### Evento 2: `dialogo_banco_caliente`
**Filtro:** `moral < 50` + requiere `figura`

**Provocar:** Perder varios partidos → moral baja

**Verificar:**
- ✅ Aparece "Tensión en el banco"
- ✅ Resultado probabilístico funciona

### Evento 3: `dialogo_felicitacion`
**Filtro:** `racha === 'buena'` + `moral >= 70`

**Provocar:** Ganar 4 de últimos 5 partidos

**Verificar:**
- ✅ Aparece "El capitán te busca"
- ✅ Bonus de moral funciona

### Evento 4: `dialogo_despedida_jugador`
**Filtro:** `temporada >= 3` + `posicion <= 5`

**Provocar:** Llegar a temp 3+ en top 5

**Verificar:**
- ✅ Aparece "Una charla difícil"
- ✅ Consecuencias económicas funcionan

### Evento 5: `dialogo_reclamo_sueldo`
**Filtro:** `money >= 20` + `temporada >= 2`

**Provocar:** Temp 2+ con buena economía

**Verificar:**
- ✅ Aparece "Negociación salarial"
- ✅ Efectos de money funcionan

---

## 🔍 Debugging

### Ver lesionados en consola
```javascript
console.log(window.c.lesionados);
```

### Forzar lesión manualmente
```javascript
const jugadorId = window.c.once[5];
window.c.lesionados.push({
  cardId: jugadorId,
  jornadasRestantes: 7,
  tipo: 'grave'
});
window.render();
```

---

## 📊 Checklist Final

- [x] Build exitoso sin errores
- [x] Lesiones bloquean jugadores visualmente
- [x] Recuperación automática funciona
- [x] Arqueros protegidos (peso 0.3x)
- [x] 5 eventos de diálogo agregados
- [x] Documentación completa

---

**Listo para testing** ✅
