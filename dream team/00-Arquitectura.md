# ⚽ Dream Team - Modo Carrera DT
**Descripción:** Juego web de gestión de fútbol. El usuario abre sobres, gestiona variables y toma decisiones.

## 📂 Estructura Real del Proyecto (`src/`)

**1. Capa Visual y UI (La Cara del Juego)**
- `ui/`: Archivos principales de la interfaz ([[engine.md]], CustomSelect) y estilos (`cartas.css`).
- `scenes/`: Diferentes pantallas del juego (EventScene, LineupScene, PackOpening, etc.).
- `theme/` y `shared/`: Tokens de diseño y colores de las cartas.
- `assets/`: Imágenes estáticas (ej: `gold_pack.png`).

**2. El Motor y la Lógica (El Cerebro)**
- `engine/`: **NÚCLEO DEL JUEGO**. Maneja el balance, el progreso de la carrera, simulación de partidos (`seasonSimulator.js`), y la lógica de las cartas.
- `state/` y `core/`: Manejo del estado (`careerState.js`), constantes globales y manejo de errores.
- `packOpening/`: Lógica específica para abrir sobres y el modo draft.

**3. Datos y Conexiones Externas (Los Músculos)**
- `data/`: Repositorios que hablan con Supabase (`authRepo`, `cardsRepo`), catálogos duros (ligas, escudos, países).
- `net/`: Clientes de conexión (`supabaseClient.js`, y el `evento.js` para pedir narraciones a la IA).
- `events/`: Lógica para filtrar qué candidatos participan en los eventos.

**4. Utilidades y Desarrollo (Herramientas)**
- `utils/`: Funciones de ayuda general (generar escudos, formatear imágenes, banderas).
- `dev/`: Panel de trampas/herramientas de desarrollador para probar cosas rápido (`DevPanel.js`).

## 🔗 Enlaces Rápidos a Sistemas
- Para ver la lógica deportiva: [[engine]]
- Para ver cómo se guardan los datos: [[BaseDeDatos]]
- Para ver cómo funciona la generación dinámica: [[IA]]