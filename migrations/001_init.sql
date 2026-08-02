-- =====================================================================
-- 001_init.sql
-- Schema base: extensiones, catálogo de cartas y economía mínima
-- para que 002_staging.sql, 003_apply_approved.sql y
-- 004_open_pack.sql tengan sobre qué pararse.
-- =====================================================================

begin;

-- Extensiones: gen_random_uuid() (pgcrypto) y gin_trgm_ops para el
-- índice de similitud de nombres que usa 002_staging.sql
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Posiciones en español, mismas siglas que usa ingest-fpl.js al
-- mapear el element_type de FPL
create type position_type as enum ('POR', 'DEF', 'MED', 'DEL');

-- ---------------------------------------------------------------------
-- cards: catálogo público de jugadores/cartas
-- ---------------------------------------------------------------------
create table public.cards (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  club            text,
  "position"      position_type,
  pace            smallint not null default 40 check (pace between 0 and 99),
  shooting        smallint not null default 40 check (shooting between 0 and 99),
  passing         smallint not null default 40 check (passing between 0 and 99),
  defense         smallint not null default 40 check (defense between 0 and 99),
  physical        smallint not null default 40 check (physical between 0 and 99),
  goalkeeping     smallint not null default 40 check (goalkeeping between 0 and 99),
  -- Generada a partir de las 6 stats. apply-approved.js escribe el
  -- mismo rating en las 6 para que este promedio dé exactamente ese
  -- número (ver 003_apply_approved.sql).
  overall_rating  smallint generated always as (
    round((pace + shooting + passing + defense + physical + goalkeeping) / 6.0)
  ) stored,
  rarity          text not null default 'comun'
                    check (rarity in ('comun', 'rara', 'epica', 'legendaria')),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index idx_cards_position on public.cards ("position");
create index idx_cards_overall_rating on public.cards (overall_rating);
create index idx_cards_is_active on public.cards (is_active);

-- Catálogo público: cualquiera puede leer cartas activas. Escritura
-- solo vía service_role (scripts/apply-approved.js), sin policy de
-- insert/update/delete para anon/authenticated.
alter table public.cards enable row level security;

create policy "cards_public_select"
  on public.cards for select
  using (is_active = true);

-- ---------------------------------------------------------------------
-- users: coins del jugador para abrir sobres (open_pack la usa)
-- ---------------------------------------------------------------------
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  coins       integer not null default 500 check (coins >= 0),
  created_at  timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id);

create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------
-- packs: tipos de sobre disponibles para comprar
-- ---------------------------------------------------------------------
create table public.packs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  price_coins  integer not null check (price_coins > 0),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.packs enable row level security;

create policy "packs_public_select"
  on public.packs for select
  using (active = true);

-- ---------------------------------------------------------------------
-- pack_openings: historial de aperturas (lo llena open_pack)
-- ---------------------------------------------------------------------
create table public.pack_openings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  pack_id      uuid not null references public.packs(id),
  coins_spent  integer not null,
  created_at   timestamptz not null default now()
);

alter table public.pack_openings enable row level security;

create policy "pack_openings_select_own"
  on public.pack_openings for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- card_instances: cartas que efectivamente posee cada usuario
-- ---------------------------------------------------------------------
create table public.card_instances (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  card_id          uuid not null references public.cards(id),
  pack_opening_id  uuid references public.pack_openings(id),
  created_at       timestamptz not null default now()
);

create index idx_card_instances_user_id on public.card_instances (user_id);

alter table public.card_instances enable row level security;

create policy "card_instances_select_own"
  on public.card_instances for select
  using (auth.uid() = user_id);

commit;