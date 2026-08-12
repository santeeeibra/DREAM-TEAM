# Dream Team — INDEX
> Leer este archivo primero.

## Estado actual
- Deploy: dream-team-ruddy.vercel.app
- Supabase: vtulaokxfljnqbkudvbk (sa-east-1)
- Bloqueante activo: ninguno
- Última sesión (2026-08-11): **Fase 2 del draft inicial real**. El onboarding
  dejó de usar el mock local y la edge `open-pack` para el draft; ahora abre
  **3 sobres × 5 cartas de la liga elegida** vía `openInitialPacks()`
  (`src/data/cardsRepo.js` → `draftSquad` en `src/packOpening/draftSquad.js`),
  con el catálogo real de `cards` filtrado por `league_id` y guardado en
  `user_cards` antes de la animación. Las 3 ligas activas son Premier / LaLiga
  / Serie A (20 clubes cada una, fuente única `src/data/leagues.js`); el motor
  y el balance (v1.6.0) resuelven tiers, estilos y presión inicial por
  `club_id`. `open-pack` quedó solo para el sobre de refuerzo. Smoke de UI en
  verde: 15 cartas por draft, 8 temporadas completas. Sin bloqueantes técnicos.
- Antes (misma sesión, commits previos): la IA ya no menciona jugadores en
  eventos genéricos (tag `individual` en `narrador.js`, ver
  `07-bugs-backlog.md`) y los chips de fatiga/presión usan ↑/↓ con color por
  bueno/malo. Jerarquía estricta de skills del Workspace:
  `dream-team-architecture` → `dream-team-cards` → `dream-team-events`; las
  skills globales de diseño solo entran como complemento secundario.

## Próximo bloque (siguiente sesión)
1. Prueba en navegador contra Supabase real (el smoke usa stubs, no la BD):
   crear DT en cada liga → abrir los 3 sobres de esa liga → armar 11 →
   simular un tramo.
2. Monitorear el build de Vercel tras `dd7ef37` (ya en el remoto).
3. Bugs vigentes: fotos OVR < 74 (Premier) y calidad narrativa GROQ
   (ver 07-bugs-backlog.md). 

## Archivos de contexto
- Arquitectura → 01-arquitectura.md
- DB schema → 02-db-schema.md
- Engine/balance → 03-engine-balance.md
- Eventos/narrador → 04-eventos-narrator.md
- Cartas/packs → 05-cartas-packs.md
- UI/animaciones → 06-ui-animaciones.md
- Bugs activos → 07-bugs-backlog.md
- Template Cline → 08-brief-template.md
