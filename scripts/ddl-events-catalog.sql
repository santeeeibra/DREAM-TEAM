-- ═══════════════════════════════════════════════════════════════════════
-- Migración de events_catalog al shape nuevo:
--   id (text pk) · familia (enum) · requisitos (jsonb) · peso (int)
--   slots (jsonb) · opciones (jsonb)
--
-- FLUJO COMPLETO (3 pasos):
--   1) Correr este script en el SQL Editor de Supabase (secciones 0–5).
--   2) Cargar los 12 eventos:  node --env-file=.env scripts/seed-events-catalog.js
--   3) Correr la sección "POST-SEED" (abajo, separada) para recrear las
--      FKs entrantes contra events_catalog(id). Se corre DESPUÉS del seed
--      porque antes la tabla está vacía y todos los event_code históricos
--      serían "huérfanos".
--
-- - Se descubren y dropean las FKs entrantes (NO usa CASCADE).
-- - Si en el POST-SEED quedan event_code históricos que no existen en el
--   catálogo nuevo, la FK de esa tabla NO se crea y lo avisa en notices.
-- ═══════════════════════════════════════════════════════════════════════

-- 0) Limpiar por si se re-corre en la misma sesión
DROP TABLE IF EXISTS _fk_backup;

-- 1) Backup de las FKs entrantes a events_catalog
CREATE TEMP TABLE _fk_backup AS
SELECT
  c.conname,
  c.conrelid::regclass::text AS tbl,
  (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
     FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS cols
FROM pg_constraint c
WHERE c.contype = 'f' AND c.confrelid = 'events_catalog'::regclass;

-- 2) Dropear las FKs entrantes (sin CASCADE)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM _fk_backup LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.tbl, r.conname);
    RAISE NOTICE 'FK % de % dropeada.', r.conname, r.tbl;
  END LOOP;
END $$;

-- 3) Drop de la tabla vieja (ya sin dependencias)
DROP TABLE IF EXISTS events_catalog;

-- 4) Enum de familia
DO $$ BEGIN
  CREATE TYPE familia_evento AS ENUM ('individual', 'tactico', 'institucional', 'vestuario');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5) Tabla nueva con el shape pedido
CREATE TABLE events_catalog (
  id          text PRIMARY KEY,
  familia     familia_evento NOT NULL,
  requisitos  jsonb NOT NULL DEFAULT '{}'::jsonb,
  peso        integer NOT NULL DEFAULT 10,
  slots       jsonb NOT NULL DEFAULT '[]'::jsonb,
  opciones    jsonb NOT NULL
);

-- 6) RLS: lectura pública, escritura abierta a anon/authenticated.
--    El seed usa la anon key del .env vía supabase-js. service_role
--    bypasea RLS por defecto y no necesita policy. Si después se quiere
--    restringir la escritura, alcanza con dropear
--    "events_catalog_escritura_seed".
ALTER TABLE events_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_catalog_lectura_publica"
  ON events_catalog FOR SELECT
  USING (true);

CREATE POLICY "events_catalog_escritura_seed"
  ON events_catalog FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Limpiar el backup temp (ya no hace falta en el paso 1)
DROP TABLE _fk_backup;


-- ═══════════════════════════════════════════════════════════════════════
-- POST-SEED — CORRER DESPUÉS DE CARGAR LOS 12 EVENTOS
-- (Seleccionar solo este bloque y ejecutarlo cuando el paso 2 esté hecho)
-- ═══════════════════════════════════════════════════════════════════════
-- CREATE TEMP TABLE _fk_backup AS
-- SELECT
--   c.conname,
--   c.conrelid::regclass::text AS tbl,
--   (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
--      FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
--      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS cols
-- FROM pg_constraint c
-- WHERE c.contype = 'f' AND c.confrelid = 'events_catalog'::regclass;
--
-- DO $$
-- DECLARE
--   r record;
--   col_sql text;
--   huerfanos int;
-- BEGIN
--   FOR r IN SELECT * FROM _fk_backup LOOP
--     SELECT string_agg(format('%I', x), ',') INTO col_sql
--     FROM unnest(string_to_array(r.cols, ',')) AS x;
--
--     EXECUTE format(
--       'SELECT count(*) FROM %I s WHERE s.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM events_catalog e WHERE e.id = s.%I)',
--       r.tbl, r.cols, r.cols
--     ) INTO huerfanos;
--
--     IF huerfanos = 0 THEN
--       EXECUTE format(
--         'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES events_catalog(id)',
--         r.tbl, r.tbl || '_' || r.cols || '_fkey', col_sql
--       );
--       RAISE NOTICE 'FK % recreada sobre events_catalog(id).', r.tbl || '_' || r.cols || '_fkey';
--     ELSE
--       RAISE NOTICE 'FK de % NO recreada: % valores huerfanos contra events_catalog(id).',
--         r.tbl, huerfanos;
--     END IF;
--   END LOOP;
-- END $$;
--
-- DROP TABLE _fk_backup;