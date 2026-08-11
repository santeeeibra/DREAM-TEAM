# 01-arquitectura
Fuente de verdad (estado/vars): `src/ui/main.js` (primeras líneas) + capas del proyecto.

## Capas
- **Motor** (`src/engine/`) — lógica pura Node: no importa Phaser, Supabase ni DOM. `state.js` es el único camino de mutación con clamps.
- **UI** (`src/ui/main.js`) — DOM: solo render e input. Lee el motor y llama sus funciones; **no calcula reglas ni efectos**.
- **Datos/red** (`src/data/`, `src/net/`) — persistencia Supabase y fetch de narración (`pedirNarracion` en `src/net/evento.js`).
- **IA** — GROQ vía proxy serverless. La key nunca va al cliente; no se llama a la IA en el camino crítico del render.
- Nota: existe una entrada legacy Phaser (`src/main.js`, `src/scenes/`, `src/objects/`, `src/packOpening/`) que convive con la capa DOM; la capa visual documentada acá es `src/ui/main.js`.

## Imports del motor usados por la UI
- Carrera: `iniciarCarrera`, `confirmarOnce`, `jugarTramo`, `resumenCarrera`, `abrirRefuerzo`, `registrarRefuerzo`, `aplicarRefuerzo`.
- Eventos: `candidatosDelTramo`, `fijarNarracion`, `resolverEvento`, `contexto`, `paquete`.
- Lineup/ratings: `autoOnce`, `FORMACION`, `ratingEnSlot`, `penalidad`, `slotsVacios`, `posiciones`, `miPosicion`, `ratingActual`.
- Constantes/fases: `FASES`, `CARRERA`, `LIGA`, `RANGOS`, `valorDeVenta`.
- Otros: `CLUBES_JUGABLES` (`data/nombres.js`), `generateClubBadgeDataURI` (`utils/badgeGenerator.js`).

## Constantes y helpers de UI
- `PACK_ID` — único pack disponible (Sobre Dream Team, `b34f5178-…`): 3 sobres gratis del onboarding + sobre de refuerzo post-temporada.
- `esc(s)` — escape HTML de `& < > "`.
- `ICONO` — `{ money: 💰, moral: 😊, fatiga: 🔋, presion: 🔥, ratingDelta: ⭐ }`.
- `NOMBRE_VAR` — `{ money: 'Plata', moral: 'Moral', fatiga: 'Fatiga', presion: 'Presión', ratingDelta: 'Nivel' }`.
- `MALO_SI_SUBE` — `Set(['fatiga', 'presion'])`. Fatiga y presión: **subir es malo** → color por bueno/malo, no por signo matemático.
- `EXPLICACION_VAR` — recordatorio corto de qué mueve cada variable (moral "sube = rinde mejor", presion "llega a 100 y te echan", etc.).
- `SIL_CARTA` — SVG data-URI, silueta de fallback para cartas sin foto (es el `<img src>` por defecto).
- `PAISES` / `BANDERAS` — 24 países `[nombre, código ISO]`; dropdown con bandera (flagcdn.com). El valor guardado es el **nombre** del país (se persiste en `managers.country`).
- `LIGAS` — `premier` y `laliga`, con logos de api-sports.io (CDN público temporal; `onerror` los oculta).
- `ESCUDOTECA` (`src/data/escudoteca.js`) — único lugar de escudos reales: mapa nombre → URL (Escudoteca Paladar Negro + api-sports.io para Atlético/Girona/Mallorca). Incluye alias de nombre y lookup normalizado `escudoDeNombre(nombre)`. Luton Town y Real Oviedo sin URL → fallback SVG.
- `escudoDe(cl)` / `escudoRival(nombre)` / `escudoClub(nombre)` — patrón de fallback: badge real (`badge_url` / `club_badge_url` / `badge` / `ui.miEscudo`) → teca local (`escudoDeNombre`) → si falta o el CDN falla, SVG generado por nombre (`badgeGenerator.js`). **Nunca queda un club sin escudo.**

## Estado visual (objeto `ui`)
Estado de la pantalla, no del juego:
- `vista: 'intro'`, `vistaAnterior`, `slot: null`, `sobresAbiertos: []`, `deltas: null`, `tabla: false`.
- `sel: Set()` (selección) y `salen: Set()` (cartas que salen) — para los sobres.
- `fuenteIA: null`, `cargando: false`, `detalleAbierto: Set()`, `miEscudo: ''`.
- `onboarding: { liga, clubes: [], clubId, nombre, pais, cargando, error, enviando, abierto, modo: 'facil' }` — `modo` es `'facil' | 'dificil'`.
- `c` — el estado del motor (carrera); `null` hasta `iniciarCarrera`.

## Reglas
- La UI no calcula reglas ni efectos; solo render e input.
- Fatiga/presión suben = malo: color por bueno/malo y flechas ↑/↓, nunca `+8` verde en un chip de fatiga.
- Toda variable que cambie tras una decisión tiene que verse cambiar en pantalla.
