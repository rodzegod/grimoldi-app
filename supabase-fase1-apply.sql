-- ============================================================
-- FASE 1 — SQL COMPLETO E IDEMPOTENTE
-- Ejecutar en: https://supabase.com/dashboard/project/rnduzkdlanmbcxrqfria/sql
-- Aplica TODOS los fixes de Fase 1. Seguro de re-ejecutar.
-- ============================================================

-- ── Helper functions (idempotente) ───────────────────────────
create or replace function mi_rol()
returns text as $$
  select rol from usuarios where id = auth.uid();
$$ language sql security definer stable;

create or replace function mi_local()
returns uuid as $$
  select local_id from usuarios where id = auth.uid();
$$ language sql security definer stable;


-- ══════════════════════════════════════════════════════════════
-- FIX 1 — HORARIOS
-- Problema: faltaba unique constraint en horarios_dias para que
--           el upsert con onConflict funcionara.
-- ══════════════════════════════════════════════════════════════

create table if not exists horarios (
  id uuid primary key default gen_random_uuid(),
  local_id uuid references locales(id),
  semana_inicio date not null,
  usuario_id uuid references usuarios(id),
  created_at timestamptz default now(),
  unique(local_id, semana_inicio, usuario_id)
);

create table if not exists horarios_dias (
  id uuid primary key default gen_random_uuid(),
  horario_id uuid references horarios(id) on delete cascade,
  dia_semana int not null,
  tipo text check (tipo in ('horario','FRANCO','FRANCO MES','MERCADERIA','LICENCIA','INVENTARIO')),
  hora_entrada text,
  hora_salida text,
  horas_extra decimal default 0,
  horas_devueltas decimal default 0,
  observacion text
);

-- Constraint crítico: necesario para que el upsert onConflict funcione
alter table horarios_dias
  drop constraint if exists horarios_dias_horario_id_dia_semana_key;
alter table horarios_dias
  add constraint horarios_dias_horario_id_dia_semana_key
  unique (horario_id, dia_semana);

alter table horarios enable row level security;
alter table horarios_dias enable row level security;

drop policy if exists "ver horarios del local" on horarios;
drop policy if exists "encargado gestiona horarios" on horarios;
drop policy if exists "ver horarios dias" on horarios_dias;
drop policy if exists "encargado gestiona horarios dias" on horarios_dias;

create policy "ver horarios del local" on horarios
  for select using (local_id = mi_local());
create policy "encargado gestiona horarios" on horarios
  for all using (mi_rol() in ('encargado','admin') and local_id = mi_local());
create policy "ver horarios dias" on horarios_dias
  for select using (
    exists (select 1 from horarios where id = horario_id and local_id = mi_local())
  );
create policy "encargado gestiona horarios dias" on horarios_dias
  for all using (
    mi_rol() in ('encargado','admin') and
    exists (select 1 from horarios where id = horario_id and local_id = mi_local())
  );


-- ══════════════════════════════════════════════════════════════
-- FIX 2 — USUARIOS: encargado puede ver usuarios de su local
-- Problema: RLS solo permitía ver el propio perfil → dropdown vacío
-- ══════════════════════════════════════════════════════════════

drop policy if exists "encargado ve usuarios del local" on usuarios;
create policy "encargado ve usuarios del local" on usuarios
  for select using (
    mi_rol() in ('encargado','admin') and local_id = mi_local()
  );


-- ══════════════════════════════════════════════════════════════
-- FIX 3 — TAREAS: constraint estado + tabla tareas_plantilla
-- ══════════════════════════════════════════════════════════════

-- Ampliar constraint estado para incluir pendiente_derivar
alter table tareas drop constraint if exists tareas_estado_check;
alter table tareas add constraint tareas_estado_check
  check (estado in ('pendiente','en_progreso','completada','pendiente_derivar'));

-- Tabla de plantillas de tareas recurrentes
create table if not exists tareas_plantilla (
  id uuid primary key default gen_random_uuid(),
  local_id uuid references locales(id),
  titulo text not null,
  tipo text check (tipo in ('Admin','Operativo','Liderazgo')),
  turno text check (turno in ('mañana','tarde','ambos')),
  prioridad text check (prioridad in ('Urgente','Importante','Relevante')),
  frecuencia text check (frecuencia in ('diaria','semanal','mensual')),
  dias_semana int[] default '{}',
  dia_mes int,
  activa boolean default true,
  creado_por uuid references usuarios(id),
  created_at timestamptz default now()
);

alter table tareas_plantilla enable row level security;

drop policy if exists "encargado gestiona plantillas" on tareas_plantilla;
drop policy if exists "ver plantillas" on tareas_plantilla;
create policy "encargado gestiona plantillas" on tareas_plantilla
  for all using (mi_rol() in ('encargado','admin') and local_id = mi_local());
create policy "ver plantillas" on tareas_plantilla
  for select using (local_id = mi_local());


-- ══════════════════════════════════════════════════════════════
-- FIX 4 — APERTURA / CIERRE: tablas aperturas y apertura_items
-- ══════════════════════════════════════════════════════════════

create table if not exists aperturas (
  id uuid primary key default gen_random_uuid(),
  local_id uuid references locales(id),
  fecha date not null,
  turno text check (turno in ('mañana','tarde')),
  registrado_por uuid references usuarios(id),
  estado text default 'pendiente' check (estado in ('pendiente','completado')),
  created_at timestamptz default now(),
  unique(local_id, fecha, turno)
);

create table if not exists apertura_items (
  id uuid primary key default gen_random_uuid(),
  apertura_id uuid references aperturas(id) on delete cascade,
  tarea text not null,
  completado boolean default false,
  observacion text,
  completado_at timestamptz,
  completado_por uuid references usuarios(id)
);

alter table aperturas enable row level security;
alter table apertura_items enable row level security;

drop policy if exists "ver aperturas del local" on aperturas;
drop policy if exists "vendedor registra apertura" on aperturas;
drop policy if exists "vendedor actualiza apertura" on aperturas;
drop policy if exists "ver apertura items" on apertura_items;

create policy "ver aperturas del local" on aperturas
  for select using (local_id = mi_local());
create policy "vendedor registra apertura" on aperturas
  for insert with check (local_id = mi_local());
create policy "vendedor actualiza apertura" on aperturas
  for update using (local_id = mi_local());
create policy "ver apertura items" on apertura_items
  for all using (
    exists (select 1 from aperturas where id = apertura_id and local_id = mi_local())
  );


-- ══════════════════════════════════════════════════════════════
-- FIX 5 — STOCK HISTORIAL: encargado tiene acceso completo
-- ══════════════════════════════════════════════════════════════

create table if not exists stock_historial (
  id uuid primary key default gen_random_uuid(),
  local_id uuid references locales(id),
  fecha date not null,
  codigo text not null,
  medida text not null,
  familia text,
  marca text,
  modelo text,
  stock int default 0,
  created_at timestamptz default now(),
  unique(local_id, fecha, codigo, medida)
);

alter table stock_historial enable row level security;

drop policy if exists "encargado gestiona stock historial" on stock_historial;
drop policy if exists "supervisor ve stock historial" on stock_historial;
drop policy if exists "vendedor ve stock historial" on stock_historial;

create policy "encargado gestiona stock historial" on stock_historial
  for all using (mi_rol() in ('encargado','admin') and local_id = mi_local());
create policy "supervisor ve stock historial" on stock_historial
  for select using (mi_rol() = 'supervisor' and local_id = mi_local());


-- ══════════════════════════════════════════════════════════════
-- EXTRA — Otras tablas necesarias (idempotente)
-- ══════════════════════════════════════════════════════════════

create table if not exists movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid references productos(id) on delete cascade,
  zona_id uuid references zonas(id),
  tipo text not null check (tipo in ('entrada','salida')),
  cantidad int not null default 1,
  motivo text not null,
  registrado_por uuid references usuarios(id),
  local_id uuid references locales(id),
  revisado boolean default false,
  created_at timestamptz default now()
);

alter table movimientos_stock enable row level security;

drop policy if exists "ver movimientos del local" on movimientos_stock;
drop policy if exists "vendedor registra movimiento" on movimientos_stock;
drop policy if exists "encargado gestiona movimientos" on movimientos_stock;

create policy "ver movimientos del local" on movimientos_stock
  for select using (local_id = mi_local());
create policy "vendedor registra movimiento" on movimientos_stock
  for insert with check (local_id = mi_local() and registrado_por = auth.uid());
create policy "encargado gestiona movimientos" on movimientos_stock
  for update using (mi_rol() in ('encargado','admin') and local_id = mi_local());

create table if not exists ventas_diarias (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  vendedor_id uuid references usuarios(id),
  local_id uuid references locales(id),
  calzado int default 0,
  indumentaria int default 0,
  accesorios int default 0,
  monto_total bigint default 0,
  comprobantes int default 0,
  created_at timestamptz default now(),
  unique(fecha, vendedor_id, local_id)
);

alter table ventas_diarias enable row level security;

drop policy if exists "encargado gestiona ventas" on ventas_diarias;
drop policy if exists "supervisor ve ventas" on ventas_diarias;
drop policy if exists "vendedor ve sus ventas" on ventas_diarias;

create policy "encargado gestiona ventas" on ventas_diarias
  for all using (mi_rol() in ('encargado','admin') and local_id = mi_local());
create policy "supervisor ve ventas" on ventas_diarias
  for select using (mi_rol() = 'supervisor' and local_id = mi_local());
create policy "vendedor ve sus ventas" on ventas_diarias
  for select using (vendedor_id = auth.uid());

create table if not exists comunicados (
  id uuid primary key default gen_random_uuid(),
  local_id uuid references locales(id),
  titulo text not null,
  contenido text not null,
  autor_id uuid references usuarios(id),
  fijado boolean default false,
  created_at timestamptz default now(),
  expira_at date
);

create table if not exists comunicados_vistos (
  comunicado_id uuid references comunicados(id) on delete cascade,
  usuario_id uuid references usuarios(id),
  visto_at timestamptz default now(),
  primary key (comunicado_id, usuario_id)
);

alter table comunicados enable row level security;
alter table comunicados_vistos enable row level security;

drop policy if exists "ver comunicados del local" on comunicados;
drop policy if exists "encargado gestiona comunicados" on comunicados;
drop policy if exists "registrar visto" on comunicados_vistos;

create policy "ver comunicados del local" on comunicados
  for select using (local_id = mi_local());
create policy "encargado gestiona comunicados" on comunicados
  for all using (mi_rol() in ('encargado','admin') and local_id = mi_local());
create policy "registrar visto" on comunicados_vistos
  for all using (usuario_id = auth.uid());

alter table productos add column if not exists descripcion text;
alter table productos add column if not exists stock_actual int default 0;
alter table productos add column if not exists stock_fecha date;


-- ══════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ══════════════════════════════════════════════════════════════

select table_name from information_schema.tables
  where table_schema = 'public' order by table_name;

select conname, pg_get_constraintdef(oid) as def
  from pg_constraint
  where conrelid = 'horarios_dias'::regclass;

select tablename, policyname
  from pg_policies
  where schemaname = 'public'
  order by tablename, policyname;
