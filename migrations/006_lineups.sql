-- =====================================================================
-- 006_lineups.sql
-- Tabla `lineups`: guarda el 11 titular (y el banco) que arma cada
-- manager. La usa src/lineups.js (saveLineup / getLineup).
--
-- NOTA (2026-08-01): este archivo se reescribió para reflejar el
-- esquema real de la tabla en producción. La versión original definía
-- `season_id uuid` sin FK, pensado para "cuando exista `seasons`". Esa
-- tabla `seasons` ya existe (Fase 4, career mode), pero se creó con
-- una migración aplicada directo contra la base ("create_career_mode_
-- tables") que nunca se bajó a este directorio. Esa migración además
-- reemplazó `lineups.season_id` por `lineups.season_number integer
-- not null` (referenciando a `managers.current_season` /
-- `seasons.season_number`, no a un id de fila) y agregó `is_active`.
-- src/lineups.js estaba desactualizado contra ese cambio (por eso el
-- error "column lineups.season_id does not exist"); ya se corrigió
-- para usar season_number.
-- =====================================================================

begin;

create table public.lineups (
  id            uuid primary key default gen_random_uuid(),
  manager_id    uuid not null references public.managers(id) on delete cascade,
  season_number integer not null,
  formation     text not null default '4-3-3',
  -- Forma esperada de slots:
  -- { formation: "4-4-2", starters: [{ slot: "GK", card_id: "..." }, ...], bench: ["card_id", ...] }
  -- Los card_id de acá adentro son ids de `user_cards` (la copia puntual
  -- que tiene el manager), no de `cards` (el catálogo).
  slots         jsonb not null,
  is_active     boolean not null default true,
  updated_at    timestamptz not null default now()
);

create index idx_lineups_manager_id on public.lineups (manager_id);

alter table public.lineups enable row level security;

-- Mismo patrón que el resto de las tablas "propias" del usuario: el
-- dueño se valida indirectamente, siguiendo manager_id -> managers.user_id,
-- porque lineups no tiene un user_id propio.
create policy "lineups_select_own"
  on public.lineups for select
  using (
    exists (
      select 1 from public.managers m
      where m.id = manager_id and m.user_id = auth.uid()
    )
  );

create policy "lineups_insert_own"
  on public.lineups for insert
  with check (
    exists (
      select 1 from public.managers m
      where m.id = manager_id and m.user_id = auth.uid()
    )
  );

create policy "lineups_update_own"
  on public.lineups for update
  using (
    exists (
      select 1 from public.managers m
      where m.id = manager_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.managers m
      where m.id = manager_id and m.user_id = auth.uid()
    )
  );

commit;
