# 🗄️ Base de Datos (Supabase)
**Responsabilidad:** Persistencia de datos y fetching de catálogos desde `src/data` y `src/net`.

**¿Qué guardamos/leemos?**
- **Managers:** El perfil del DT (nombre, club elegido, país, dificultad).
- **Sobres (Packs):** La generación de los 3 sobres iniciales y el sobre de refuerzo post-temporada se calculan en la DB y se devuelven al frontend.
- **Cartas (Pool global):** Todos los jugadores disponibles divididos por liga. Si la DB falla, el juego tiene un *fallback* (plan B) a un catálogo local de prueba para no trabar la partida.