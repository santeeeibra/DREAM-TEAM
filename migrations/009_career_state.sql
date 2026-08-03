-- =====================================================================
-- 009_career_state.sql
-- Soporte para src/state/careerState.js.
--
-- careerState.js es dueño de money, pressure y streak (y del corte de
-- moral/fatiga entre tramos), y persiste ese estado en dos momentos: al
-- resolver un evento y al cerrar la temporada (nunca fecha a fecha, para
-- no hacer 38 escrituras por temporada).
--
-- Las columnas seasons.pressure, seasons.streak y seasons.matchday ya
-- existen en la base (se agregaron antes de esta migración, fuera de
-- migrations/, con sus propios defaults: pressure=50 "neutral", streak=0,
-- matchday=0). No las volvemos a crear ni les tocamos el default: eso
-- cambiaría cómo arranca una temporada nueva. Lo único que faltaba era el
-- CHECK de rango a nivel de columna (careerState.js ya clampea en memoria
-- vía applyEffects/syncStreakFromResultados, pero un CHECK en la base es
-- la misma red de seguridad que ya tienen pace/shooting/etc. en `cards`):
--   - pressure: 0-100, misma escala que morale/fatigue.
--   - streak: -38 a 38 (cota defensiva: el extremo teórico es cubrir toda
--     la temporada, ver TOTAL_MATCHDAYS en src/engine/seasonSimulator.js).
--   - matchday: 0-38 (0 = todavía no arrancó ninguna fecha).
-- =====================================================================

begin;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'seasons_pressure_range'
  ) then
    alter table public.seasons
      add constraint seasons_pressure_range check (pressure between 0 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'seasons_streak_range'
  ) then
    alter table public.seasons
      add constraint seasons_streak_range check (streak between -38 and 38);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'seasons_matchday_range'
  ) then
    alter table public.seasons
      add constraint seasons_matchday_range check (matchday between 0 and 38);
  end if;
end $$;

commit;
