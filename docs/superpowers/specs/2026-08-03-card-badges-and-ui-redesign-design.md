# Escudos/banderas/liga en las cartas + rediseño UI de LineupScene

## Contexto

`LineupScene.js` (armado del 11 titular) tiene dos problemas de legibilidad
hoy: el nombre del jugador se solapa con la foto en la carta
(`RevealCardSprite.js`), y las tabs POR/DEF/MED/DEL son texto plano sin
jerarquía visual. Además, la carta no muestra bandera de país, escudo de
club ni logo de liga (estilo EA FC Ultimate Team), porque esos datos no
existen hoy en `cards`.

El proyecto ya tiene un pipeline de enriquecimiento de datos desde fut.gg
(`scripts/fetch-futgg-images.js`, columna `cards.fut_id`) que resuelve
`photo_url` descargando la imagen y resubiéndola a Storage propio. Este
trabajo extiende ese mismo pipeline y luego usa los datos resultantes para
rediseñar la carta y el resto de la UI de LineupScene.

Se divide en dos fases independientes:

- **Fase 1 (este spec la implementa)**: script de enriquecimiento de datos.
- **Fase 2 (diseño incluido, implementación posterior)**: consumo en el
  frontend, una vez que Fase 1 corrió y `cards` tiene las URLs.

## Fase 1 — Datos: escudo de club, bandera de país, logo de liga

### Fuente de datos

`GET https://www.fut.gg/api/fut/player-item-definitions/26/{fut_id}/`
(mismo dominio que ya usa `fetch-futgg-images.js`; confirmado con fetch real
contra un `fut_id` existente). La respuesta trae objetos anidados `club`,
`nation` y `league`, cada uno con:

- `eaId` (número estable, identifica al club/país/liga en sí, no a la carta)
- `imageUrl` (URL pública en `game-assets.fut.gg`)

Se consulta por `fut_id`, no por nombre: cero ambigüedad, a diferencia de la
búsqueda por nombre que usa `fetch-futgg-images.js` para resolver la foto.

### Migración: `migrations/010_club_nation_league_badges.sql`

- Agrega a `cards`: `club_badge_url text`, `nation_flag_url text`,
  `league_logo_url text` (mismo estilo que `photo_url` de `005`).
- Crea el bucket público `team-badges` en Storage (mismo patrón que el
  bucket `player-photos` de `005`).

### Script: `scripts/fetch-futgg-badges.js`

Mismo esqueleto que `fetch-futgg-images.js` (dotenv + supabase-js +
service role key, nunca corta el loop por un jugador, resumen final).

1. Trae cartas con `fut_id is not null` y con alguna de las 3 columnas
   nuevas en `null` (permite correr incremental sin repetir trabajo ya
   hecho).
2. Por carta: pide el detalle por `fut_id`, extrae `club`, `nation`,
   `league` (`eaId` + `imageUrl` de cada uno).
3. **Dedup en memoria por `eaId`**: un club/país/liga se repite en decenas
   de cartas. Antes de descargar, chequea un `Map` en memoria
   (`club eaId -> URL pública ya subida`); si ya se subió en esta misma
   corrida, reusa esa URL sin volver a pegarle a fut.gg ni a Storage. Sube
   como mucho ~30 clubes + ~10 ligas + ~90 países, no un archivo por carta.
4. Para cada badge nuevo: descarga el `imageUrl`, convierte a WebP con
   `sharp` (preservando transparencia, sin el resize agresivo de las
   fotos — son íconos chicos), sube a `team-badges` en
   `club/{eaId}.webp` / `nation/{eaId}.webp` / `league/{eaId}.webp` con
   `upsert: true`.
5. Actualiza la fila de `cards` con las 3 URLs públicas resultantes.
6. Rate-limit ~300ms entre llamadas reales a fut.gg (no cuenta los hits de
   cache en memoria). Soporta `--limit N` para pruebas chicas, igual que
   `fetch-futgg-images.js`.
7. Log por carta (✅/❌) y resumen final: procesadas, ok, sin `fut_id`
   (saltadas), fallidas.

### Fuera de alcance de Fase 1

- No resuelve `fut_id` para cartas que todavía no lo tienen (eso ya lo hace
  `fetch-futgg-images.js`; este script las deja pendientes).
- No toca `photo_url` ni ninguna otra columna existente.
- No agrega columnas `club_id`/`nation_id`/`league_id` — el `eaId` solo se
  usa como clave de dedup del nombre de archivo en Storage, no se persiste
  en `cards` (YAGNI: no hay hoy ninguna feature que necesite agrupar cartas
  por esos ids).

## Fase 2 — Frontend (diseño; se implementa después de correr Fase 1)

Estrictamente estético — no toca lógica de selección, estado de lineup ni
validación de formación.

### Carta (`RevealCardSprite.js`)

- Gradiente oscuro (transparente → negro/gris oscuro) en el tercio inferior
  del fondo, detrás de nombre y club, para que el texto blanco no se pierda
  contra la foto. Padding ajustado para que nombre/club no se amontonen.
- Columna vertical chica debajo del rating/posición (esquina superior
  izquierda, estilo carta EA FC): bandera de país → logo de liga → escudo
  de club, en ese orden. Si `nation_flag_url`/`league_logo_url`/
  `club_badge_url` es `null` (Fase 1 no corrida todavía, o carta sin
  `fut_id`), esa fila simplemente no dibuja el ícono correspondiente — no
  rompe el render.
- Precarga en `LineupScene.preload()` con `scene.load.image`, mismo
  mecanismo que ya existe para `photo_url`, cacheando por clave de textura
  (`club_badge_url` etc.) para no recargar el mismo ícono repetido entre
  cartas del mismo club/país/liga.

### `LineupScene.js`

- Tabs POR/DEF/MED/DEL: de texto plano a segmented control tipo píldora.
  Inactiva: texto gris sobre fondo transparente con hover sutil. Activa:
  fondo sólido, `border-radius` ~99px simulado con `fillRoundedRect`, texto
  oscuro, badge de contador ("1/4") integrado.
- Paneles (footer, recuadro de validación) con bordes redondeados
  generosos y padding amplio.
- Sombra sutil en elementos interactivos: rectángulo oscuro offset por
  detrás (no `postFX.addShadow`, porque el juego corre en `Phaser.AUTO` y
  no se puede asumir renderer WebGL).
- Al cambiar de tab (`cambiarTab`/`reconstruirGrillaVisible`): las cartas
  entran con `Phaser.Tweens` de escala + fade, `ease: 'Cubic.out'`,
  duración corta, en vez de aparecer instantáneamente.

## Testing

- Fase 1: `node --check scripts/fetch-futgg-badges.js`; correr con
  `--limit 5` contra la base real antes de la corrida completa.
- Fase 2 (cuando se implemente): `node --check` sobre los archivos
  tocados + `node scripts/simulate-career.js --carreras=50` (no debería
  verse afectado, es un cambio puramente visual) + verificación manual en
  navegador de LineupScene.
