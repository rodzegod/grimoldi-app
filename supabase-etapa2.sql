-- ============================================================
-- ETAPA 2 — Nuevas tablas y políticas
-- Ejecutar en: https://supabase.com/dashboard/project/rnduzkdlanmbcxrqfria/sql
-- ============================================================

-- 1. FIX: encargado puede ver todos los usuarios de su local (fix dropdown vacío)
drop policy if exists "encargado ve usuarios del local" on usuarios;
create policy "encargado ve usuarios del local" on usuarios
  for select using (mi_rol() in ('encargado', 'admin') and local_id = mi_local());

-- 2. Campo descripcion en productos
alter table productos add column if not exists descripcion text;

-- 3. Tabla movimientos_stock
create table if not exists movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid references productos(id) on delete cascade,
  zona_id uuid references zonas(id),
  tipo text not null check (tipo in ('entrada', 'salida')),
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
  for update using (mi_rol() in ('encargado', 'admin') and local_id = mi_local());

-- 4. Tabla ventas_diarias
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

-- Verificar
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;
