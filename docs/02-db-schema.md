# 02-db-schema
Fuente de verdad: `migrations/` (raíz del repo — `supabase/functions/` está vacía). 12 migraciones + `apply-approved.js`.

## 001_init.sql — base
- Extensiones: `pgcrypto` (gen_random_uuid) y `pg_trgm` (índices de similitud de nombres).
- Enum `position_type`: `POR`, `DEF`, `MED`, `DEL`.
- **cards** (catálogo público): `id uuid`, `name`, `club`, `position`, 6 stats smallint 0–99 default 40 (`pace`, `shooting`, `passing`, `defense`, `physical`, `goalkeeping`), `overall_rating` GENERATED (promedio de las 6), `rarity` check `comun/rara/epica/legendaria`, `is_active`, `created_at`. RLS: SELECT público solo `is_active = true`; escritura solo service_role.
- **users**: `id = auth.users.id` (cascade), `coins ≥ 0` default 500. RLS solo propio.
- **packs**: `name`, `price_coins > 0`, `active`. RLS SELECT público.
- **pack_openings**: `user_id → users`, `pack_id → packs`, `coins_spent`.
- **card_instances**: `user_id`, `card_id → cards`, `pack_opening_id`.

## 002_staging.sql — ingesta de jugadores
- **staging_players**: volcado crudo de FPL (`source`, `external_id`, `name`, `club`, `position`, `raw_data jsonb`; unique(source, external_id); índice trgm en `name`). Sin policies: solo service_role.
- **pending_changes**: cola de revisión — `change_type` (`new_player`/`club_change`/`removed`), `card_id`, `staging_player_id`, `payload jsonb`, `status` (`pending`/`approved`/`rejected`). Solo admin (RLS).
- Función `is_admin()`: lee `auth.jwt() → app_metadata.role = 'admin'`.

## 003_apply_approved.sql — aplicar cambios aprobados
- Amplía `pending_changes.status` a `applied`.
- Funciones plpgsql, una transacción por cambio (falla ⇒ rollback y queda `approved` para reintentar):
  - `apply_new_player_change` — insert en `cards` replicando el rating en las 6 stats (para que `overall_rating` generado dé exacto).
  - `apply_club_change_change` — update de club + stats.
  - `apply_removed_change` — `is_active = false`, nunca borra la carta.

## 004_open_pack.sql — apertura transaccional
- `open_pack(p_user_id, p_pack_id) → jsonb { cards, balance }`. Pasos: valida pack activo → lock de fila en `users` (FOR UPDATE, evita carreras) → valida saldo → registra `pack_openings` → sortea 5 cartas activas por banda de `overall_rating` → descuenta coins.
- Bandas originales: Bronze 40–64 70% | Silver 65–74 20% | Gold 75–84 8% | Special 85–99 2%; 5ta carta mínimo Silver (66.7/26.7/6.7). **Reemplazadas en 007.**
- Permisos: revoke a `anon`/`authenticated`, grant solo a `service_role`.

## 005_player_photos.sql — fotos
- `cards` += `uses_generated_avatar` (default true), `photo_url`, `photo_credit`, `photo_source_url`.
- Bucket público `player-photos`. Escritura solo service_role.

## 006_lineups.sql — 11 titular
- **lineups**: `manager_id → managers` (cascade), `season_number integer`, `formation` default `4-3-3`, `slots jsonb`, `is_active`, `updated_at`.
- `slots` = `{ formation, starters: [{ slot, card_id }], bench: [card_id] }`. Los `card_id` son de **user_cards** (la copia del manager), no de `cards`.
- RLS: dueño validado indirectamente (`managers.user_id = auth.uid()`).
- Nota: la tabla `seasons` nació de una migración directa a la base (`create_career_mode_tables`) **nunca versionada acá**; `lineups.season_number` reemplazó al viejo `season_id`.

## 007_pack_probabilities.sql — bandas recalibradas
- Reemplaza `open_pack`. Bandas 1:1 con `RATING_TIERS` de `scripts/seed-players.js` (65–92): BRONZE 65–72 45% | SILVER 73–78 30% | GOLD 79–85 18% | SPECIAL 86–92 7%. Misma probabilidad para las 5 cartas (se saca el piso de la 5ta).

## 008_fut_id.sql — IDs de EA FUT
- `cards` += `fut_id text` + índice. Imagen oficial: `https://cdn.fut.gg/cards/26/p{id}.png`.

## 009_career_state.sql — clamps en seasons
- CHECKs en `seasons`: `pressure` 0–100, `streak` −38..38, `matchday` 0–38. (Las columnas ya existían, creadas fuera de `migrations/`.)

## 010_club_nation_league_badges.sql — badges
- `cards` += `club_badge_url`, `nation_flag_url`, `league_logo_url`.
- Bucket público `team-badges`; archivos deduplicados por eaId de fut.gg: `club/{eaId}.webp`, `nation/{eaId}.webp`, `league/{eaId}.webp`.

## 011_manager_profile_ids.sql — perfil del DT
- `managers` += `league_id`, `club_id` (slugs estables de `src/data/leagues.js`), `reputation smallint not null default 50` + CHECK 0–100 + backfill null→50.
- Mantiene las columnas legacy `league`/`club` (texto) intactas.

## 012_events_catalog_seed.sql — seed de eventos
- Inserta 15 eventos en `events_catalog` (`code`, `title`, `description`, `min_matchday`, `weight`, `options jsonb`). Re-ejecutable: `ON CONFLICT (code) DO UPDATE`.
- `options[].effects` usan claves de negocio: `morale`, `fatigue`, `money`, `rating_efectivo`, `pressure`.

## Alertas / divergencias (schema real vs versionado)
- **`managers`, `seasons`, `user_cards`, `season_events` NO se crean en `migrations/`**: se referencian (006, 009, 011 y FKs cascade) pero nacieron de migraciones directas a la base. Su DDL no está versionado en el repo.
- **`events_catalog` tiene dos shapes distintos:**
  - `scripts/ddl-events-catalog.sql` define `id text PK` + `familia` (enum) + `requisitos/peso/slots/opciones` (flujo de eventos actual; las FKs entrantes se dropean/recrean manualmente).
  - `012_events_catalog_seed.sql` asume `id uuid` + columna `code` + `title/description/min_matchday`.
  - **Verificar cuál está vivo en Supabase antes de tocar eventos.**
- `open_pack` (004/007) sortea por bandas de `overall_rating`; la columna `rarity` y el sistema `pack_cards` son otro sistema de probabilidades que `open_pack` no usa.
