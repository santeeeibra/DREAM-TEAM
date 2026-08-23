# ⚙️ src/engine (El Motor)
**Responsabilidad:** Calcular la lógica invisible del juego. No toca el HTML ni la pantalla, solo devuelve datos.

**Archivos Clave:**
- `carrera.js`: Maneja el estado global del DT (en qué temporada está, qué tramo se juega).
- `seasonSimulator.js` / `liga.js`: Simula los partidos, calcula si se gana o se pierde basándose en la fuerza del equipo (OVR), la [[BaseDeDatos.md|Moral]] y la [[BaseDeDatos.md|Fatiga]].
- `balance.js`: Tiene las constantes matemáticas (penalizaciones por jugar fuera de posición, rangos máximos de estadísticas).