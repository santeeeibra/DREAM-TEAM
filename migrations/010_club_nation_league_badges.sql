-- =====================================================================
-- 010_club_nation_league_badges.sql
-- Soporte para scripts/fetch-futgg-badges.js.
--
-- Agrega a `cards` las columnas para el escudo de club, la bandera de
-- país y el logo de liga (estilo carta EA FC Ultimate Team), resueltos
-- desde fut.gg por fut_id y resubidos a Storage propio (mismo patrón
-- que photo_url en 005_player_photos.sql). Crea el bucket público
-- team-badges donde viven esos archivos, deduplicados por eaId de
-- fut.gg (club/{eaId}.webp, nation/{eaId}.webp, league/{eaId}.webp) en
-- vez de uno por carta.
-- =====================================================================

begin;

alter table public.cards
  add column if not exists club_badge_url   text,
  add column if not exists nation_flag_url  text,
  add column if not exists league_logo_url  text;

-- Bucket público: los badges se sirven directo por URL pública, sin
-- pasar por una policy de storage.objects en cada lectura. Escritura
-- solo vía service_role (scripts/fetch-futgg-badges.js), mismo patrón
-- que el bucket player-photos en 005_player_photos.sql.
insert into storage.buckets (id, name, public)
values ('team-badges', 'team-badges', true)
on conflict (id) do nothing;

commit;
