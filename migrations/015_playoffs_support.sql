-- =====================================================================
-- 015_playoffs_support.sql
-- Soporte para play-offs en Liga Profesional Argentina.
--
-- Agrega campos a la tabla `seasons` para persistir:
-- - zone: zona del equipo en ligas con zonas ('A' o 'B')
-- - playoffs_result: resultado de los play-offs (JSONB con fase eliminado,
--   rival, y flag de campeón)
--
-- El motor de play-offs vive en src/engine/playoffsSimulator.js y
-- src/engine/zonesTable.js, y la integración en SeasonScene.js.
-- =====================================================================

begin;

-- Agregar columna zone (TEXT) para ligas con zonas
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'seasons' 
    and column_name = 'zone'
  ) then
    alter table public.seasons
      add column zone text check (zone in ('A', 'B') or zone is null);
  end if;
end $$;

-- Agregar columna playoffs_result (JSONB) para resultados de play-offs
-- Estructura esperada:
-- {
--   "status": "CAMPEON" | "ELIMINADO_PLAYOFFS" | "ELIMINADO_FASE_REGULAR",
--   "fase_eliminado": "Octavos" | "Cuartos" | "Semifinales" | "Final" | null,
--   "rival_eliminador": "Nombre del club" | null,
--   "campeon": true | false
-- }
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'seasons' 
    and column_name = 'playoffs_result'
  ) then
    alter table public.seasons
      add column playoffs_result jsonb default null;
  end if;
end $$;

-- Crear índice para consultas por zona
create index if not exists idx_seasons_zone on public.seasons (zone)
  where zone is not null;

commit;
