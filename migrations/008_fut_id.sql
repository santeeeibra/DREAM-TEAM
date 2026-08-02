-- =====================================================================
-- 008_fut_id.sql
-- Soporte para scripts/apply-fut-matches.js.
--
-- Agrega a `cards` la columna `fut_id` (string) que identifica la carta
-- oficial de EA FC FUT en el CDN de fut.gg. Cuando un jugador tiene
-- fut_id asignado, las escenas usan su imagen oficial de fut.gg
-- (https://cdn.fut.gg/cards/26/p{id}.png) en vez de la foto vieja o el
-- avatar generado.
-- =====================================================================

begin;

alter table public.cards
  add column if not exists fut_id text;

-- Índice para búsquedas por fut_id (útil si algún día se filtra por él).
create index if not exists idx_cards_fut_id on public.cards (fut_id);

commit;