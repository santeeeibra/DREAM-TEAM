# Sistema de Lesiones Persistentes y Diálogos con el DT

**Fecha:** 2026-08-25  
**Objetivo:** Implementar sistema de lesiones que bloquee jugadores lesionados + diálogos estilo FIFA/EA FC

---

## ✅ 1. Sistema de Lesiones Persistentes

### Cambios en `src/engine/carrera.js`

#### Estado de carrera
- **Nuevo campo:** `lesionados: [{ cardId, jornadasRestantes, tipo }]`
- Se inicializa vacío en `iniciarCarrera()` y se carga desde DB en `cargarCarrera()`

#### `elegirReemplazoLesion()` (L438-485)
- **Antes:** Solo sacaba al jugador del 11 y aplicaba penalidad si no había reemplazo
- **Ahora:** Registra la lesión en `c.lesionados[]` con duración igual al próximo tramo completo
- **Duración:** `jornadasRestantes = LIGA.TRAMOS[c.tramo]` (típicamente 7 jornadas)
- **Tipo:** `'grave'` (puede extenderse a `'leve'` en el futuro)

#### `jugarTramo()` (L291-298)
- **Nueva lógica:** Decrementa `jornadasRestantes` de cada lesión según las jornadas jugadas
- **Recuperación:** Filtra y remueve lesiones con `jornadasRestantes <= 0`
- **Efecto:** Los jugadores se recuperan automáticamente después de jugar suficientes partidos

---

## ✅ 2. Protección de Arqueros

### Cambios en `src/engine/candidatosEvento.js`

#### `jugadorAleatorioDelOnce()` (L183-201)
- **Antes:** Selección uniforme sobre todos los titulares
- **Ahora:** Selección ponderada por posición
- **Pesos:**
  - `POR`: 0.3x (70% menos probable de lesionarse)
  - `DEF/MED/DEL`: 1.0x (probabilidad normal)
- **Razón:** El usuario suele tener solo 1 arquero en el plantel

---

## ✅ 3. Bloqueo Visual en UI

### Cambios en `src/ui/main.js`

#### Vista `once` (L1323-1391)
- **Nuevo:** `lesionadosSet` identifica cartas lesionadas desde `c.lesionados`
- **Aviso visual:** Mensaje rojo arriba del 11 listando jugadores lesionados
- **Cartas bloqueadas:**
  - Clase `bloqueada` aplicada (ya existía en `cartas.css`)
  - `motivo: '🚑 Lesionado'` reemplaza edad en la carta
  - `draggable: false` impide arrastrarlas
  - `accion: ''` impide seleccionarlas al tocarlas
- **Botón confirmar:** `disabled` si hay lesionados en el 11
- **Estilo:** `.card.bloqueada { filter: grayscale(.7); opacity: .5; cursor: not-allowed; }`

---

## ✅ 4. Diálogos con el DT (estilo FIFA/EA FC)

### Nuevos eventos en `src/engine/catalogoEventos.js` (L1022-1141)

#### `dialogo_pide_titularidad`
- **Filtro:** `moral >= 60` + requiere `figura`
- **Contexto:** Jugador en buen momento pide más continuidad
- **Opciones:**
  - "Le prometo titularidad" → 70% moral +6, 30% presión +5
  - "La rotación es innegociable" → 60% moral -4, 40% moral -8 + presión +8

#### `dialogo_banco_caliente`
- **Filtro:** `moral < 50` + requiere `figura`
- **Contexto:** Jugador suplente amenaza con irse
- **Opciones:**
  - "Lo calmo y le prometo cambios" → 50/50 se calma o empeora
  - "Acá se juega lo que yo digo" → 40% crisis, 60% gana autoridad

#### `dialogo_felicitacion`
- **Filtro:** `racha === 'buena'` + `moral >= 70` + requiere `figura`
- **Contexto:** Capitán felicita al DT por la racha
- **Opciones:**
  - "Esto recién empieza" → moral +5, fatiga -2
  - "Sin relajarse, falta mucho" → moral +2, presión -3

#### `dialogo_despedida_jugador`
- **Filtro:** `temporada >= 3` + `posicion <= 5` + requiere `figura`
- **Contexto:** Jugador clave recibe oferta del exterior
- **Opciones:**
  - "Andá tranquilo, te lo ganaste" → moral -8, money +15, rating -3
  - "Te necesito acá, no te vayas" → 30% se queda (moral +10), 70% se va resentido

#### `dialogo_reclamo_sueldo`
- **Filtro:** `money >= 20` + `temporada >= 2` + requiere `figura`
- **Contexto:** Jugador pide renegociar contrato
- **Opciones:**
  - "Le subo el sueldo" → money -10, moral +8, fatiga -3
  - "No hay presupuesto" → 50/50 acepta o rinde mal en cancha

---

## 📊 Impacto en el Juego

### Lesiones
- **Realismo:** Un jugador lesionado no puede jugar el próximo tramo
- **Estrategia:** Importancia de tener un banco competitivo
- **Arqueros:** Menos propensos a lesionarse (1 cada ~3.5 lesiones de campo)

### Diálogos
- **Narrativa:** Conexión emocional con el plantel
- **Consecuencias:** Decisiones afectan moral, presión, dinero y rating
- **Variedad:** 5 tipos de conversaciones, cada una con ramificaciones probabilísticas

---

## 🔧 Persistencia en Base de Datos

### Columna `lesionados` en tabla `managers`
```sql
ALTER TABLE managers ADD COLUMN lesionados JSONB DEFAULT '[]';
```

**Estructura:**
```json
[
  { "cardId": "abc123", "jornadasRestantes": 5, "tipo": "grave" },
  { "cardId": "def456", "jornadasRestantes": 2, "tipo": "grave" }
]
```

---

## 🎮 Flujo de Usuario

1. **Evento de lesión** → Fase `LESION` → Elegir reemplazo
2. **Registro persistente** → Jugador bloqueado en `c.lesionados[]`
3. **Bloqueo visual** → No se puede poner en el 11, carta atenuada
4. **Jugar tramo** → Decrementa `jornadasRestantes`
5. **Recuperación automática** → Después de X jornadas, vuelve a estar disponible

---

## 📝 TODOs Futuros (opcionales)

- [ ] Tipos de lesión: `'leve'` (2-3 jornadas) vs `'grave'` (7 jornadas)
- [ ] Probabilidad de recaída si vuelve muy rápido
- [ ] Notificación visual cuando un jugador se recupera
- [ ] Eventos de lesión más variados (fractura, desgarro, etc.)
- [ ] Diálogos con más jugadores (no solo figura)

---

**Archivos modificados:**
- `src/engine/carrera.js` (lesionados[], elegirReemplazoLesion, jugarTramo)
- `src/engine/candidatosEvento.js` (jugadorAleatorioDelOnce con pesos)
- `src/engine/catalogoEventos.js` (5 nuevos eventos de diálogo)
- `src/ui/main.js` (vista once con bloqueo visual)

**Build exitoso:** ✅ `npm run build` completado sin errores
