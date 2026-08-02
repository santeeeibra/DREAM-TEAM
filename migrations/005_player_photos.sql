-- =====================================================================
-- 005_player_photos.sql
-- Soporte para scripts/fetch-player-photos.js.
--
-- Agrega a `cards` las columnas que necesita el pipeline de fotos
-- reales (Wikipedia/Commons) y crea el bucket público player-photos
-- en Supabase Storage. uses_generated_avatar arranca en true para
-- todas las cartas existentes: hoy usan el avatar de
-- src/utils/avatarGenerator.js hasta que el script les consiga foto.
-- =====================================================================

begin;

alter table public.cards
  add column if not exists uses_generated_avatar boolean not null default true,
  add column if not exists photo_url             text,
  add column if not exists photo_credit           text,
  add column if not exists photo_source_url        text;

-- Bucket público: las fotos se sirven directo por URL pública, sin
-- pasar por una policy de storage.objects en cada lectura.
insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true)
on conflict (id) do nothing;

-- Escritura solo vía service_role (scripts/fetch-player-photos.js
-- usa SUPABASE_SERVICE_KEY, que bypassea RLS), así que no hace falta
-- policy de insert/update para anon/authenticated. Mismo patrón que
-- `cards` en 001_init.sql.

commit;
