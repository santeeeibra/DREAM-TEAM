-- =====================================================================
-- 011_manager_profile_ids.sql
-- Perfil del DT extendido para la pantalla de creación de manager:
--
--   - league_id / club_id: slugs estables (ej. 'premier-league' /
--     'arsenal') definidos en src/data/leagues.js. Se persisten junto a
--     los nombres (league/club) que ya existían, para que las escenas
--     siguientes resuelvan logos y escudos por id sin depender del
--     nombre en español.
--   - reputation: reputación inicial del DT (0-100). Nace en 50
--     ("neutral") igual que pressure. La consume careerState.js y la
--     narrativa de eventos (api/narrar-evento.js).
--
-- Mantiene las columnas legacy `league`/`club` (texto) intactas: todos
-- los flujos existentes (getManagerParaTemporada, badges, etc.) siguen
-- funcionando igual.
-- =====================================================================

begin;

alter table public.managers
  add column if not exists league_id  text,
  add column if not exists club_id    text;

-- reputation: si la columna recién se agrega, default 50; si ya existía
-- (caso idempotente), el default no pisa valores vigentes.
alter table public.managers
  add column if not exists reputation smallint not null default 50;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'managers_reputation_range'
  ) then
    alter table public.managers
      add constraint managers_reputation_range check (reputation between 0 and 100);
  end if;
end $$;

-- Backfill defensivo: si la columna ya existía como nullable (creada fuera
-- de esta migración, p.ej. por algún script de dev) y algún manager quedó
-- con reputation null, lo llevamos al default 50 ("neutral"). Este update
-- es idempotente: correr la migración dos veces no cambia nada.
update public.managers
  set reputation = 50
  where reputation is null;

commit;