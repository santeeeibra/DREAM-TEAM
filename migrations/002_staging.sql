-- =====================================================================
-- 002_staging.sql
-- Pipeline de staging para ingesta de jugadores desde fuentes externas
-- (por ahora Fantasy Premier League) y su reconciliación contra el
-- catálogo público `cards`.
--
-- Diseño:
--   staging_players  -> volcado crudo de la fuente externa, sin curar.
--                       Solo la toca el backend (scripts con
--                       service_role). No hay policies de cliente.
--   pending_changes  -> cola de revisión generada por scripts/reconcile.js.
--                       Nunca escribe directo sobre `cards`; un admin
--                       humano revisa y aprueba/rechaza desde acá.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. staging_players
-- ---------------------------------------------------------------------
create table public.staging_players (
  id           uuid primary key default gen_random_uuid(),
  source       text not null,
  external_id  text not null,
  name         text not null,
  club         text,
  "position"   text,
  raw_data     jsonb not null default '{}'::jsonb,
  fetched_at   timestamptz not null default now(),
  unique (source, external_id)
);

create index idx_staging_players_source on public.staging_players (source);
create index idx_staging_players_name_trgm on public.staging_players using gin (name gin_trgm_ops);

-- RLS habilitado a propósito sin ninguna policy: el cliente (anon o
-- authenticated) no tiene acceso a esta tabla bajo ningún caso. Solo
-- el service_role (que bypassea RLS) puede leerla/escribirla, que es
-- como corren scripts/ingest-fpl.js y scripts/reconcile.js.
alter table public.staging_players enable row level security;


-- ---------------------------------------------------------------------
-- 2. pending_changes
-- ---------------------------------------------------------------------
create table public.pending_changes (
  id                  uuid primary key default gen_random_uuid(),
  change_type         text not null check (change_type in ('new_player', 'club_change', 'removed')),
  card_id             uuid references public.cards(id) on delete cascade,
  staging_player_id   uuid references public.staging_players(id) on delete cascade,
  payload             jsonb not null default '{}'::jsonb,
  status              text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at          timestamptz not null default now()
);

create index idx_pending_changes_status on public.pending_changes (status);
create index idx_pending_changes_change_type on public.pending_changes (change_type);
create index idx_pending_changes_card_id on public.pending_changes (card_id);
create index idx_pending_changes_staging_player_id on public.pending_changes (staging_player_id);

-- Helper: true si el JWT del usuario trae el claim de admin.
-- Asume que el rol se setea en app_metadata (ej: vía Supabase Auth
-- Admin API: `update_user(id, { app_metadata: { role: 'admin' } })`
-- o un custom access token hook). app_metadata es la ubicación
-- correcta para esto porque el usuario final no puede editarla desde
-- el cliente (a diferencia de user_metadata).
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

alter table public.pending_changes enable row level security;

create policy "pending_changes_admin_select"
  on public.pending_changes for select
  using (public.is_admin());

create policy "pending_changes_admin_insert"
  on public.pending_changes for insert
  with check (public.is_admin());

create policy "pending_changes_admin_update"
  on public.pending_changes for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "pending_changes_admin_delete"
  on public.pending_changes for delete
  using (public.is_admin());
-- Sin policy para usuarios no-admin: no tienen acceso de ningún tipo.
-- El service_role (scripts/reconcile.js) bypassea RLS igual, así que
-- estas policies solo gobiernan el acceso vía anon/authenticated key.

commit;
