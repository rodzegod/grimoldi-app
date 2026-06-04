-- Agregar 'pendiente_derivar' al constraint de tareas.estado
-- Ejecutar en: https://supabase.com/dashboard/project/rnduzkdlanmbcxrqfria/sql

alter table tareas drop constraint if exists tareas_estado_check;
alter table tareas add constraint tareas_estado_check
  check (estado in ('pendiente','en_progreso','completada','pendiente_derivar'));

-- Verificar
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'tareas'::regclass and contype = 'c';
