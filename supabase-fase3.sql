-- ================================================================
-- FASE 3 — SQL SCHEMA
-- Ejecutar en: https://supabase.com/dashboard/project/rnduzkdlanmbcxrqfria/sql
-- ================================================================

-- Feature 3.1 — Mapa espacial: posiciones de zonas (%)
alter table zonas add column if not exists pos_x decimal default 2;
alter table zonas add column if not exists pos_y decimal default 2;
alter table zonas add column if not exists pos_w decimal default 28;
alter table zonas add column if not exists pos_h decimal default 25;

-- Feature 3.2 — Panel merma: costo y unidades en incidencias
alter table incidencias add column if not exists costo_unitario int default 0;
alter table incidencias add column if not exists unidades int default 1;

-- Migrar tipos viejos antes de cambiar el constraint
update incidencias set tipo = 'faltante_stock'   where tipo = 'talle_faltante';
update incidencias set tipo = 'deterioro_falla'  where tipo in ('par_incompleto','pies_cruzados','defecto_producto');
-- 'otro' ya existe en ambos schemas

-- Nuevos tipos de incidencia
alter table incidencias drop constraint if exists incidencias_tipo_check;
alter table incidencias add constraint incidencias_tipo_check
  check (tipo in (
    'hurto_robo','rotura_dano','faltante_stock',
    'error_admin','devolucion','deterioro_falla','otro'
  ));

-- Verificación
select column_name from information_schema.columns
  where table_name = 'zonas' and column_name like 'pos_%';

select column_name from information_schema.columns
  where table_name = 'incidencias' and column_name in ('costo_unitario','unidades');

select conname from pg_constraint where conrelid = 'incidencias'::regclass;
