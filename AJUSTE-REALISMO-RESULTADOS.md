# Ajuste de Realismo en Resultados — Dream Team

## Cambio realizado: 2026-08-25

### Problema identificado
Los resultados de partidos eran demasiado extremos:
- Muchas goleadas (3-0, 4-0, 5-0)
- Pocos empates y resultados ajustados
- Marcadores irreales para el nivel de diferencia entre equipos

### Objetivo
Generar resultados más realistas:
- Más empates (1-1, 0-0, 2-2)
- Más victorias ajustadas (1-0, 2-1)
- Menos goleadas (3-0, 4-0 deben ser excepcionales)

## Cambios realizados en `src/engine/seasonSimulator.js`

### 1. AZAR_MAX_SWING: 8 → 5 (línea 47)
Reduce volatilidad de partido a partido.

### 2. VOLATILIDAD_MAX_MULTIPLICADOR: 1.75 → 1.5 (línea 53)
Crisis genera menos azar extremo (50% en vez de 75%).

### 3. VENTAJA_LOCAL: 4 → 2.5 (línea 56)
Local sigue con ventaja pero no tan decisiva.

### 4. BASE_GOLES_ESPERADOS: 1.3 → 1.15 (línea 59)
**CLAVE:** Baja goles esperados base, más 0-0, 1-0, 1-1.

**Con lambda 1.15:**
- 0 goles: ~32%
- 1 gol: ~36%
- 2 goles: ~21%
- 3+ goles: ~11%

### 5. DIVISOR_FUERZA_A_GOLES: 15 → 18 (línea 60)
Diferencia de fuerza impacta menos. Se necesitan 18 puntos (en vez de 15) para +1 gol de lambda.

### 6. LAMBDA_MIN: 0.2 → 0.3 (línea 61)
El débil tiene más chance de gol (26% vs 18%).

### 7. LAMBDA_MAX: 4.0 → 2.8 (línea 62) ⚠️ **MÁS IMPORTANTE**
**Elimina goleadas constantes.**

**Con lambda 2.8:**
- 3 goles: ~22%
- 4 goles: ~16%
- 5+ goles: ~15% ← Excepcional

**Antes (lambda 4.0):**
- 5+ goles: ~36% ← Demasiado ❌

## Impacto esperado

### ✅ Más comunes
- 1-0, 0-1, 1-1, 0-0, 2-1, 2-0

### ⚠️ Excepcionales
- 3-0 (raro), 4-0 (muy raro), 5+ (extremo)

### 🔄 Mantiene dinámica
- Crisis sigue generando volatilidad
- Sorpresas posibles pero no constantes
- Rating sigue importando

## Fórmula actualizada

```javascript
fuerzaFinal = rating + (moral/10) - (fatiga/10) + 2.5 + azar
azar = triangular(-5, 5) * (1.0 a 1.5x)
lambda = 1.15 + (diferencia / 18)
lambda = clamp(lambda, 0.3, 2.8)
goles = poisson(lambda)
```

---
**Autor:** Kiro | **Fecha:** 2026-08-25
