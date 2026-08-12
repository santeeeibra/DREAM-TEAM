-- =====================================================================
-- 014_manager_anon_access.sql
-- Versiona el acceso del rol anon/authenticated a `managers`.
--
-- Bug: el GET /rest/v1/managers?select=id devolvía 400 (permission
-- denied) en bases donde los grants/policies se hicieron a mano en el
-- dashboard y se pierden al restaurar. `managers` no se crea en
-- migrations/ (ver docs/02-db-schema.md, "Alertas / divergencias"), así
-- que su RLS y sus grants quedaban sin versionar.
--
-- Sin login, `anon` es el único actor del flujo:
--   - INSERT: crearManager (crear el DT).
--   - SELECT: leer estado y datos del manager.
--   - UPDATE: money, current_season, reputation (loop de temporada).
-- DELETE queda deliberadamente fuera del grant: el loop no lo usa.
--
-- Solo toca `managers`. Idempotente: correrla dos veces no cambia nada.
-- =====================================================================

begin;

-- `authenticated` también cubre el guest real de Supabase
-- (authRepo.signInAnonymously), que resuelve con ese rol.
grant select, insert, update on public.managers to anon, authenticated;

-- Política RLS permisiva para anon/authenticated. Replica el
-- comportamiento real de la base (que ya daba acceso abierto a mano) y
-- hace que INSERT/UPDATE pasen la RLS cuando está habilitada.
drop policy if exists "managers_anon_access" on public.managers;
create policy "managers_anon_access"
  on public.managers
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Asegura que la policy gobierne el acceso; si la tabla ya tenía RLS
-- habilitada, esto es un no-op.
alter table public.managers enable row level security;

commit;