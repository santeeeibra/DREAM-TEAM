-- =====================================================================
-- 001_init.sql
-- Schema inicial para juego de cartas estilo Ultimate Team
-- Target: Supabase (Postgres 15+)
--
-- IMPORTANTE (léelo antes de correr esto en producción):
-- Este archivo define el schema y las políticas de acceso a datos.
-- NO reemplaza la lógica de negocio. Todo lo que mueve economía del
-- juego (abrir sobres, comprar/vender en el mercado, otorgar logros)
-- debe ejecutarse desde Supabase Edge Functions usando la service_role
-- key (que bypassea RLS), nunca desde el cliente con la anon key.
-- Las políticas RLS de acá abajo asumen ese diseño: el usuario puede
-- LEER sus propios datos libremente, pero casi no puede ESCRIBIR
-- directamente sobre inventario, coins ni transacciones.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Extensiones
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists pg_trgm;       -- búsqueda de texto por nombre (ILIKE rápido)

-- ---------------------------------------------------------------------
-- 0.1 Tipos custom
-- ---------------------------------------------------------------------
-- Enums para dominios cerrados y estables. Para cosas que probablemente
-- vayan a crecer (tipos de transacción, status), uso text + check en
-- vez de enum, porque agregar un valor a un enum en producción es más
-- molesto (ALTER TYPE ... ADD VALUE no se puede correr dentro de una
-- transacción que además lo usa).
create type rarity_tier as enum ('comun', 'rara', 'epica', 'legendaria');
create type position_type as enum ('POR', 'DEF', 'MED', 'DEL');

-- Función genérica para mantener updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. users (perfil público 1-1 con auth.users)
-- ---------------------------------------------------------------------
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique check (char_length(username) between 3 and 24),
  coins       integer not null default 500 check (coins >= 0),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_users_username on public.users using btree (username);

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Alta automática del perfil cuando alguien se registra en auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, username, coins)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    500
  );
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Protección: nadie desde el cliente puede tocar sus propias coins ni
-- cambiarse el id. Solo el service_role (edge functions) puede.
create or replace function public.protect_users_privileged_fields()
returns trigger
language plpgsql
as $$
begin
  if new.coins <> old.coins and auth.role() <> 'service_role' then
    raise exception 'No autorizado: las coins solo se modifican desde el servidor';
  end if;
  if new.id <> old.id then
    raise exception 'No autorizado: el id de usuario no se puede modificar';
  end if;
  return new;
end;
$$;

create trigger trg_users_protect_fields
  before update on public.users
  for each row execute function public.protect_users_privileged_fields();

alter table public.users enable row level security;

create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id);

create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
-- Sin policy de insert/delete para el cliente: el alta la hace el
-- trigger (security definer) y el borrado va en cascada desde auth.users.


-- ---------------------------------------------------------------------
-- 2. cards (catálogo, lectura pública)
-- ---------------------------------------------------------------------
create table public.cards (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  club            text,
  nationality     text,
  "position"      position_type not null,
  rarity          rarity_tier not null default 'comun',

  -- stats 0-99, mismo rango conceptual que cualquier juego de fútbol,
  -- pero la fórmula de rating es propia (ver columna generada abajo)
  pace            smallint not null default 50 check (pace between 0 and 99),
  shooting        smallint not null default 50 check (shooting between 0 and 99),
  passing         smallint not null default 50 check (passing between 0 and 99),
  defense         smallint not null default 50 check (defense between 0 and 99),
  physical        smallint not null default 50 check (physical between 0 and 99),
  goalkeeping     smallint not null default 30 check (goalkeeping between 0 and 99),

  -- Rating propio por posición (no es la fórmula de FIFA/EA).
  -- Los pesos suman 1.0 en cada rama.
  overall_rating smallint generated always as (
    round(
      case "position"
        when 'POR' then goalkeeping * 0.50 + defense * 0.20 + physical * 0.20 + passing * 0.10
        when 'DEF' then defense * 0.45 + physical * 0.25 + passing * 0.15 + pace * 0.10 + shooting * 0.05
        when 'MED' then passing * 0.35 + defense * 0.20 + physical * 0.15 + pace * 0.15 + shooting * 0.15
        when 'DEL' then shooting * 0.45 + pace * 0.25 + physical * 0.15 + passing * 0.15
      end
    )
  ) stored,

  avatar_url      text,   -- avatar genérico propio, NO foto real del jugador
  external_ref    text,   -- id de API-Football u origen del dato, para trazabilidad interna
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index idx_cards_position on public.cards ("position");
create index idx_cards_rarity on public.cards (rarity);
create index idx_cards_overall_rating on public.cards (overall_rating desc);
create index idx_cards_name_trgm on public.cards using gin (name gin_trgm_ops);

alter table public.cards enable row level security;

create policy "cards_select_public"
  on public.cards for select
  using (true);
-- Sin policies de insert/update/delete: el catálogo lo carga el admin
-- vía service_role (script de carga desde API-Football), nunca el cliente.


-- ---------------------------------------------------------------------
-- 3. packs (sobres)
-- ---------------------------------------------------------------------
create table public.packs (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  price_coins     integer not null check (price_coins >= 0),
  cards_per_pack  smallint not null default 5 check (cards_per_pack > 0),
  image_url       text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create index idx_packs_active on public.packs (active);

alter table public.packs enable row level security;

create policy "packs_select_active"
  on public.packs for select
  using (active = true);


-- ---------------------------------------------------------------------
-- 4. pack_cards (probabilidad por rareza dentro de cada sobre)
-- ---------------------------------------------------------------------
create table public.pack_cards (
  id            uuid primary key default gen_random_uuid(),
  pack_id       uuid not null references public.packs(id) on delete cascade,
  rarity        rarity_tier not null,
  probability   numeric(5,4) not null check (probability >= 0 and probability <= 1),
  unique (pack_id, rarity)
);

create index idx_pack_cards_pack_id on public.pack_cards (pack_id);

-- Validación: las probabilidades de un mismo sobre deben sumar 1.0
-- (con tolerancia por redondeo). Corre en insert/update/delete.
create or replace function public.validate_pack_cards_probabilities()
returns trigger
language plpgsql
as $$
declare
  v_pack_id uuid;
  v_total numeric;
begin
  v_pack_id := coalesce(new.pack_id, old.pack_id);

  select sum(probability) into v_total
  from public.pack_cards
  where pack_id = v_pack_id;

  if v_total is not null and abs(v_total - 1.0) > 0.001 then
    raise exception 'Las probabilidades del pack % deben sumar 1.0 (suman %)', v_pack_id, v_total;
  end if;

  return coalesce(new, old);
end;
$$;

create constraint trigger trg_pack_cards_validate_probs
  after insert or update or delete on public.pack_cards
  deferrable initially deferred
  for each row execute function public.validate_pack_cards_probabilities();

alter table public.pack_cards enable row level security;

create policy "pack_cards_select_public"
  on public.pack_cards for select
  using (true);


-- ---------------------------------------------------------------------
-- 5. pack_openings (historial de aperturas)
-- ---------------------------------------------------------------------
create table public.pack_openings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  pack_id       uuid not null references public.packs(id),
  coins_spent   integer not null check (coins_spent >= 0),
  opened_at     timestamptz not null default now()
);

create index idx_pack_openings_user_id on public.pack_openings (user_id);
create index idx_pack_openings_pack_id on public.pack_openings (pack_id);
create index idx_pack_openings_opened_at on public.pack_openings (opened_at desc);

alter table public.pack_openings enable row level security;

create policy "pack_openings_select_own"
  on public.pack_openings for select
  using (auth.uid() = user_id);
-- Sin insert desde el cliente: abrir un sobre es una operación
-- transaccional (descontar coins + crear card_instances) que corre
-- en una edge function con service_role.


-- ---------------------------------------------------------------------
-- 6. card_instances (inventario por usuario)
-- ---------------------------------------------------------------------
create table public.card_instances (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  card_id           uuid not null references public.cards(id),
  pack_opening_id   uuid references public.pack_openings(id) on delete set null,
  level             smallint not null default 1 check (level >= 1),
  is_listed         boolean not null default false,
  obtained_at       timestamptz not null default now()
);

create index idx_card_instances_user_id on public.card_instances (user_id);
create index idx_card_instances_card_id on public.card_instances (card_id);
create index idx_card_instances_pack_opening_id on public.card_instances (pack_opening_id);
create index idx_card_instances_is_listed on public.card_instances (is_listed) where is_listed = true;

-- Protección: el dueño puede togglear is_listed (para publicar/retirar
-- del mercado), pero no puede reasignarse la carta, cambiar de dueño
-- ni subirse de nivel por su cuenta.
create or replace function public.protect_card_instance_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.card_id <> old.card_id
     or new.user_id <> old.user_id
     or new.level <> old.level
     or new.pack_opening_id is distinct from old.pack_opening_id then
    raise exception 'No autorizado: solo is_listed puede modificarse desde el cliente';
  end if;

  return new;
end;
$$;

create trigger trg_card_instances_protect_fields
  before update on public.card_instances
  for each row execute function public.protect_card_instance_fields();

alter table public.card_instances enable row level security;

create policy "card_instances_select_own"
  on public.card_instances for select
  using (auth.uid() = user_id);

create policy "card_instances_update_own"
  on public.card_instances for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
-- Sin insert/delete desde el cliente: las instancias las crea el
-- servidor al abrir un sobre o al resolver una venta en el mercado.


-- ---------------------------------------------------------------------
-- 7. market_listings (mercado entre usuarios)
-- ---------------------------------------------------------------------
create table public.market_listings (
  id                uuid primary key default gen_random_uuid(),
  seller_id         uuid not null references public.users(id) on delete cascade,
  buyer_id          uuid references public.users(id),
  card_instance_id  uuid not null references public.card_instances(id) on delete cascade,
  price_coins       integer not null check (price_coins > 0),
  status            text not null default 'active' check (status in ('active', 'sold', 'cancelled')),
  created_at        timestamptz not null default now(),
  sold_at           timestamptz
);

create index idx_market_listings_seller_id on public.market_listings (seller_id);
create index idx_market_listings_buyer_id on public.market_listings (buyer_id);
create index idx_market_listings_status on public.market_listings (status);
-- Como mucho una publicación activa por carta a la vez
create unique index idx_market_listings_one_active_per_instance
  on public.market_listings (card_instance_id)
  where status = 'active';

-- Mantiene is_listed en card_instances en sincro con el listing
create or replace function public.sync_card_instance_listed_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.card_instances set is_listed = true where id = new.card_instance_id;
  elsif tg_op = 'UPDATE' and new.status <> 'active' and old.status = 'active' then
    update public.card_instances set is_listed = false where id = new.card_instance_id;
  end if;
  return new;
end;
$$;

create trigger trg_market_listings_sync_flag
  after insert or update on public.market_listings
  for each row execute function public.sync_card_instance_listed_flag();

alter table public.market_listings enable row level security;

-- Cualquiera ve publicaciones activas; el vendedor y comprador ven
-- además su propio historial (aunque ya no esté activo)
create policy "market_listings_select"
  on public.market_listings for select
  using (status = 'active' or seller_id = auth.uid() or buyer_id = auth.uid());

-- El usuario publica su propia carta (la instancia debe ser suya;
-- eso lo garantiza además la RLS de card_instances al hacer el join
-- en la app, pero lo reforzamos acá)
create policy "market_listings_insert_own"
  on public.market_listings for insert
  with check (
    seller_id = auth.uid()
    and exists (
      select 1 from public.card_instances ci
      where ci.id = card_instance_id and ci.user_id = auth.uid()
    )
  );

-- El vendedor puede cancelar su propia publicación activa.
-- La COMPRA (pasar a 'sold', mover coins, transferir la carta) es una
-- operación multi-tabla que debe ir por edge function con service_role.
create policy "market_listings_cancel_own"
  on public.market_listings for update
  using (seller_id = auth.uid() and status = 'active')
  with check (seller_id = auth.uid() and status = 'cancelled');


-- ---------------------------------------------------------------------
-- 8. transactions (libro de movimientos de coins)
-- ---------------------------------------------------------------------
create table public.transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  type            text not null check (type in (
                    'pack_purchase', 'market_sale', 'market_purchase',
                    'achievement_reward', 'admin_adjustment'
                  )),
  amount_coins    integer not null,          -- positivo = crédito, negativo = débito
  balance_after   integer not null check (balance_after >= 0),
  reference_type  text,                       -- 'pack_opening' | 'market_listing' | 'achievement' | ...
  reference_id    uuid,
  created_at      timestamptz not null default now()
);

create index idx_transactions_user_id on public.transactions (user_id);
create index idx_transactions_created_at on public.transactions (created_at desc);
create index idx_transactions_reference on public.transactions (reference_type, reference_id);

alter table public.transactions enable row level security;

create policy "transactions_select_own"
  on public.transactions for select
  using (auth.uid() = user_id);
-- Sin insert/update/delete desde el cliente: el libro contable lo
-- escribe únicamente el servidor.


-- ---------------------------------------------------------------------
-- 9. achievements (catálogo de logros, lectura pública)
-- ---------------------------------------------------------------------
create table public.achievements (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name            text not null,
  description     text,
  reward_coins    integer not null default 0 check (reward_coins >= 0),
  criteria        jsonb not null default '{}'::jsonb,  -- ej: {"type":"packs_opened","count":10}
  created_at      timestamptz not null default now()
);

alter table public.achievements enable row level security;

create policy "achievements_select_public"
  on public.achievements for select
  using (true);


-- ---------------------------------------------------------------------
-- 10. user_achievements (logros desbloqueados por usuario)
-- ---------------------------------------------------------------------
create table public.user_achievements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  achievement_id  uuid not null references public.achievements(id) on delete cascade,
  unlocked_at     timestamptz not null default now(),
  claimed         boolean not null default false,
  claimed_at      timestamptz,
  unique (user_id, achievement_id)
);

create index idx_user_achievements_user_id on public.user_achievements (user_id);

alter table public.user_achievements enable row level security;

create policy "user_achievements_select_own"
  on public.user_achievements for select
  using (auth.uid() = user_id);
-- Sin insert desde el cliente: el desbloqueo lo detecta el servidor.
-- El "claim" del premio (pasar claimed a true y acreditar coins) también
-- debería ir por edge function, porque acreditar coins requiere tocar
-- la tabla users, que el cliente no puede escribir.

commit;
