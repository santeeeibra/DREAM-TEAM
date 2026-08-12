-- =====================================================================
-- 013_manager_club_id_text.sql
-- Bug: managers.club_id quedó como uuid con FK → clubs(id), pero la tabla
-- `clubs` está vacía/muerta: la fuente de verdad de clubes es
-- src/data/leagues.js (ids slug estables: 'milan', 'torino', 'juventus'…).
-- El insert de crearManager() con un slug fallaba por tipo/FK → el perfil
-- nunca se creaba.
--
-- Se pasa la columna a text y se suelta la FK antes del alter (una FK exige
-- que la columna sea uuid). Las policies RLS que referencian club_id NO se
-- tocan: ALTER TYPE no las invalida. Idempotente: correrla dos veces no
-- cambia nada.
-- =====================================================================

begin;

alter table public.managers
  drop constraint if exists managers_club_id_fkey;

-- USING explícito para el cast uuid → text, por si quedó algún uuid foráneo
-- (legacy). Los managers viejos conservan ese valor: el motor igual los hace
-- jugar en la arena Premier como fallback.
alter table public.managers
  alter column club_id type text using club_id::text;

commit;