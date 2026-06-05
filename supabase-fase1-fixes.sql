-- ============================================================
-- FASE 1 — SQL fixes
-- Ejecutar en: https://supabase.com/dashboard/project/rnduzkdlanmbcxrqfria/sql
-- ============================================================

-- Fix 1.1 — Unique constraint faltante en horarios_dias (necesario para upsert)
alter table horarios_dias
  drop constraint if exists horarios_dias_horario_id_dia_semana_key;
alter table horarios_dias
  add constraint horarios_dias_horario_id_dia_semana_key
  unique (horario_id, dia_semana);

-- Fix 1.2 — Control de stock accesible para encargado
drop policy if exists "encargado gestiona stock historial" on stock_historial;
create policy "encargado gestiona stock historial" on stock_historial
  for all using (mi_rol() in ('encargado','admin') and local_id = mi_local());

-- Fix 1.5 — Encargado puede ver usuarios de su local (fix dropdown asignación)
drop policy if exists "encargado ve usuarios del local" on usuarios;
create policy "encargado ve usuarios del local" on usuarios
  for select using (mi_rol() in ('encargado', 'admin') and local_id = mi_local());

-- Verificar
select conname, contype from pg_constraint
where conrelid = 'horarios_dias'::regclass;
