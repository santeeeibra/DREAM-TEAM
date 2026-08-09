-- =====================================================================
-- 007_pack_probabilities.sql
-- Reemplaza las bandas/probabilidades de public.open_pack() (definida
-- en 004_open_pack.sql).
--
-- Motivo: las bandas viejas (Bronze 40-64 70% | Silver 65-74 20% |
-- Gold 75-84 8% | Special 85-99 2%) datan de antes de que
-- scripts/recalibrate-ratings.js ancle todos los ratings a
-- RATING_FLOOR/RATING_CEILING = 65-92 (ver scripts/seed-players.js).
-- Con las cartas ya recalibradas en ese rango, la banda "Bronze
-- 40-64" quedaba prácticamente vacía (solo cartas nunca matcheadas
-- contra staging), y Gold/Special eran tan improbables (8%/2%) que en
-- la práctica casi no salían sobres con ninguna de las dos.
--
-- Ahora las bandas se alinean 1:1 con RATING_TIERS de
-- scripts/seed-players.js (única fuente de verdad de los cortes de
-- banda), y la probabilidad es la misma para las 5 cartas del sobre
-- (se saca el piso especial de "5ta carta mínimo Silver" que tenía la
-- versión anterior):
--   BRONZE (65-72): 45%
--   SILVER (73-78): 30%
--   GOLD   (79-85): 18%
--   SPECIAL(86-92):  7%
-- =====================================================================

begin;

create or replace function public.open_pack(
  p_user_id uuid,
  p_pack_id uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_price           integer;
  v_coins           integer;
  v_new_balance     integer;
  v_pack_opening_id uuid;
  v_roll            numeric;
  v_min             smallint;
  v_max             smallint;
  v_card_id         uuid;
  v_card_name       text;
  v_card_club       text;
  v_card_position   position_type;
  v_card_rating     smallint;
  v_cards           jsonb := '[]'::jsonb;
  i                 int;
begin
  -- 1. Precio del sobre (columna real: price_coins), solo si está activo
  select price_coins into v_price
  from public.packs
  where id = p_pack_id and active = true;

  if not found then
    raise exception 'PACK_NOT_FOUND: pack % no existe o no está activo', p_pack_id;
  end if;

  -- 2. Saldo del usuario, con lock de fila para evitar carreras entre
  -- dos aperturas simultáneas del mismo usuario
  select coins into v_coins
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'USER_NOT_FOUND: usuario % no existe', p_user_id;
  end if;

  if v_coins < v_price then
    raise exception 'SALDO_INSUFICIENTE: saldo % insuficiente para sobre de % monedas', v_coins, v_price;
  end if;

  -- 3. Registrar la apertura
  insert into public.pack_openings (user_id, pack_id, coins_spent)
  values (p_user_id, p_pack_id, v_price)
  returning id into v_pack_opening_id;

  -- 4. Elegir 5 cartas activas por banda de overall_rating. Bandas
  -- calcadas de RATING_TIERS (scripts/seed-players.js); misma
  -- probabilidad para las 5 cartas, sin piso especial en la última.
  for i in 1..5 loop
    v_roll := random();

    -- BRONZE 65-72: 45% | SILVER 73-78: 30% | GOLD 79-85: 18% | SPECIAL 86-92: 7%
    if v_roll < 0.45 then
      v_min := 65; v_max := 72;
    elsif v_roll < 0.75 then
      v_min := 73; v_max := 78;
    elsif v_roll < 0.93 then
      v_min := 79; v_max := 85;
    else
      v_min := 86; v_max := 92;
    end if;

    select id, name, club, "position", overall_rating
    into strict v_card_id, v_card_name, v_card_club, v_card_position, v_card_rating
    from public.cards
    where is_active = true
      and overall_rating between v_min and v_max
    order by random()
    limit 1;

    insert into public.card_instances (user_id, card_id, pack_opening_id)
    values (p_user_id, v_card_id, v_pack_opening_id);

    v_cards := v_cards || jsonb_build_object(
      'id', v_card_id,
      'name', v_card_name,
      'club', v_card_club,
      'position', v_card_position,
      'overall_rating', v_card_rating
    );
  end loop;

  -- 5. Descontar monedas
  update public.users
  set coins = coins - v_price
  where id = p_user_id
  returning coins into v_new_balance;

  return jsonb_build_object(
    'cards', v_cards,
    'balance', v_new_balance
  );
end;
$$;

-- CREATE OR REPLACE preserva el ACL existente del objeto, pero se
-- repite acá para que el archivo sea autocontenido y explícito.
revoke all on function public.open_pack(uuid, uuid) from public;
revoke all on function public.open_pack(uuid, uuid) from anon, authenticated;
grant execute on function public.open_pack(uuid, uuid) to service_role;

commit;
