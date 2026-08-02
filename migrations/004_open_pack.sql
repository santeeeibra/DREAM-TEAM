-- =====================================================================
-- 004_open_pack.sql
-- Soporte para supabase/functions/open-pack.
--
-- La apertura de un sobre (descontar coins + elegir 5 cartas por banda
-- de overall_rating + registrar pack_openings + crear card_instances)
-- se hace acá adentro, en una función plpgsql, para que todo corra en
-- una sola transacción implícita: si algo falla a mitad de camino
-- (saldo insuficiente, no hay cartas activas en una banda, etc.), la
-- función entera hace rollback y no queda nada a medio aplicar. Mismo
-- patrón que las funciones de 003_apply_approved.sql.
--
-- Las bandas (Bronze/Silver/Gold/Special) se basan en overall_rating,
-- que es independiente de la columna `rarity` (comun/rara/epica/
-- legendaria) y de la tabla `pack_cards`: ese es otro sistema de
-- probabilidades que ya existe en el schema pero que esta función no
-- usa, porque el pedido puntual de abrir sobres pide bandas por rating.
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

  -- 4. Elegir 5 cartas activas por banda de overall_rating
  for i in 1..5 loop
    v_roll := random();

    if i < 5 then
      -- Bronze 40-64: 70% | Silver 65-74: 20% | Gold 75-84: 8% | Special 85-99: 2%
      if v_roll < 0.70 then
        v_min := 40; v_max := 64;
      elsif v_roll < 0.90 then
        v_min := 65; v_max := 74;
      elsif v_roll < 0.98 then
        v_min := 75; v_max := 84;
      else
        v_min := 85; v_max := 99;
      end if;
    else
      -- 5ta carta: mínimo Silver garantizado. El 70% de bronze se
      -- reparte proporcionalmente entre silver/gold/special según sus
      -- pesos originales (20/8/2 sobre 30) -> 66.667% / 26.667% / 6.667%
      if v_roll < 0.666666667 then
        v_min := 65; v_max := 74;
      elsif v_roll < 0.933333333 then
        v_min := 75; v_max := 84;
      else
        v_min := 85; v_max := 99;
      end if;
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

-- Igual que el resto de la lógica de economía del juego: solo el
-- service_role (edge functions) puede invocar esto. Si se dejara el
-- default (EXECUTE a PUBLIC), cualquier usuario autenticado podría
-- llamar al RPC directo con un p_user_id ajeno y vaciarle el saldo o
-- el inventario a otro jugador.
revoke all on function public.open_pack(uuid, uuid) from public;
revoke all on function public.open_pack(uuid, uuid) from anon, authenticated;
grant execute on function public.open_pack(uuid, uuid) to service_role;

commit;
