-- =====================================================================
-- 003_apply_approved.sql
-- Soporte para scripts/apply-approved.js.
--
-- Nota: cards.is_active ya existe desde 001_init.sql (default true),
-- así que no hace falta agregarla: apply-approved.js la usa tal cual
-- para desactivar cartas en vez de borrarlas.
--
-- Lo que sí hace falta:
--   1. pending_changes.status no aceptaba 'applied' (solo pending/
--      approved/rejected). Se amplía el check constraint.
--   2. Tres funciones plpgsql, una por change_type, que hacen el
--      UPDATE/INSERT sobre `cards` + el UPDATE de pending_changes a
--      'applied' dentro de una sola transacción implícita (la función
--      completa). Si algo falla, la función entera hace rollback y la
--      fila de pending_changes queda en 'approved' para poder
--      reintentarse en la próxima corrida del script. Cada fila se
--      procesa con su propia llamada RPC, así que un fallo en una no
--      afecta a las demás.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Ampliar pending_changes.status
-- ---------------------------------------------------------------------
do $$
declare
  v_constraint_name text;
begin
  select con.conname into v_constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'pending_changes'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%pending%approved%rejected%';

  if v_constraint_name is not null then
    execute format('alter table public.pending_changes drop constraint %I', v_constraint_name);
  end if;
end $$;

alter table public.pending_changes
  add constraint pending_changes_status_check
  check (status in ('pending', 'approved', 'rejected', 'applied'));

-- ---------------------------------------------------------------------
-- 2. Funciones de aplicación (una transacción por cambio)
-- ---------------------------------------------------------------------

-- new_player: crea la carta y marca el pending_change como aplicado.
-- El rating (calculado en JS con calculateRating) se replica en las 6
-- stats base porque overall_rating es una columna generated: al pesar
-- 1.0 entre todas para cualquier posición, overall_rating termina
-- siendo exactamente ese valor.
create or replace function public.apply_new_player_change(
  p_pending_id uuid,
  p_name text,
  p_club text,
  p_position position_type,
  p_stat_value smallint
)
returns uuid
language plpgsql
as $$
declare
  v_card_id uuid;
begin
  insert into public.cards (name, club, "position", pace, shooting, passing, defense, physical, goalkeeping)
  values (p_name, p_club, p_position, p_stat_value, p_stat_value, p_stat_value, p_stat_value, p_stat_value, p_stat_value)
  returning id into v_card_id;

  update public.pending_changes
  set status = 'applied'
  where id = p_pending_id and status = 'approved';

  if not found then
    raise exception 'pending_changes % ya no está en estado approved', p_pending_id;
  end if;

  return v_card_id;
end;
$$;

-- club_change: actualiza el club de una carta existente y recalcula
-- sus stats con los datos vigentes de staging (no hay más "tier de
-- club": el rating siempre sale de calculateRating sobre stats de
-- juego, así que se recalcula directo en cada club_change aplicado).
create or replace function public.apply_club_change_change(
  p_pending_id uuid,
  p_card_id uuid,
  p_new_club text,
  p_stat_value smallint
)
returns void
language plpgsql
as $$
begin
  update public.cards
  set club = p_new_club,
      pace = p_stat_value,
      shooting = p_stat_value,
      passing = p_stat_value,
      defense = p_stat_value,
      physical = p_stat_value,
      goalkeeping = p_stat_value
  where id = p_card_id;

  if not found then
    raise exception 'card % no existe', p_card_id;
  end if;

  update public.pending_changes
  set status = 'applied'
  where id = p_pending_id and status = 'approved';

  if not found then
    raise exception 'pending_changes % ya no está en estado approved', p_pending_id;
  end if;
end;
$$;

-- removed: nunca borra la carta (puede estar en inventarios de
-- usuarios), solo la desactiva.
create or replace function public.apply_removed_change(
  p_pending_id uuid,
  p_card_id uuid
)
returns void
language plpgsql
as $$
begin
  update public.cards
  set is_active = false
  where id = p_card_id;

  if not found then
    raise exception 'card % no existe', p_card_id;
  end if;

  update public.pending_changes
  set status = 'applied'
  where id = p_pending_id and status = 'approved';

  if not found then
    raise exception 'pending_changes % ya no está en estado approved', p_pending_id;
  end if;
end;
$$;

commit;
