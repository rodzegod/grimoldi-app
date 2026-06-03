-- ============================================================
-- GRIMOLDI APP — Setup completo
-- Ejecutar en: https://supabase.com/dashboard/project/rnduzkdlanmbcxrqfria/sql
-- ============================================================

-- 1. TABLAS (idempotente con IF NOT EXISTS)
-- ============================================================

create table if not exists locales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo_sucursal text not null,
  marca text not null
);

create table if not exists usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text not null,
  rol text not null check (rol in ('vendedor','encargado','supervisor','admin')),
  local_id uuid references locales(id)
);

create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  familia text,
  marca text,
  modelo text,
  linea text,
  genero text,
  medida text,
  local_id uuid references locales(id),
  importado_at timestamptz default now(),
  unique(codigo, medida, local_id)
);

create table if not exists zonas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  orden int default 0,
  local_id uuid references locales(id)
);

create table if not exists zona_productos (
  id uuid primary key default gen_random_uuid(),
  zona_id uuid references zonas(id) on delete cascade,
  producto_id uuid references productos(id) on delete cascade,
  unique(zona_id, producto_id)
);

create table if not exists tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text check (tipo in ('Admin','Operativo','Liderazgo')),
  turno text check (turno in ('mañana','tarde','ambos')),
  prioridad text check (prioridad in ('Urgente','Importante','Relevante')),
  estado text default 'pendiente' check (estado in ('pendiente','en_progreso','completada')),
  asignado_a uuid references usuarios(id),
  creado_por uuid references usuarios(id),
  local_id uuid references locales(id),
  fecha date default current_date,
  completado_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists incidencias (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('talle_faltante','par_incompleto','pies_cruzados','defecto_producto','otro')),
  descripcion text,
  prioridad text check (prioridad in ('Urgente','Normal')),
  estado text default 'abierta' check (estado in ('abierta','en_proceso','resuelta')),
  producto_id uuid references productos(id),
  zona_id uuid references zonas(id),
  reportado_por uuid references usuarios(id),
  asignado_a uuid references usuarios(id),
  local_id uuid references locales(id),
  nota_resolucion text,
  created_at timestamptz default now(),
  resuelto_at timestamptz
);

-- 2. LOCAL PILOTO
-- ============================================================
insert into locales (nombre, codigo_sucursal, marca)
values ('Vans Parque Brown', '875', 'Vans')
on conflict do nothing;

-- 3. RLS
-- ============================================================
alter table usuarios enable row level security;
alter table productos enable row level security;
alter table zonas enable row level security;
alter table zona_productos enable row level security;
alter table tareas enable row level security;
alter table incidencias enable row level security;

-- Helper functions
create or replace function mi_rol()
returns text as $$
  select rol from usuarios where id = auth.uid();
$$ language sql security definer stable;

create or replace function mi_local()
returns uuid as $$
  select local_id from usuarios where id = auth.uid();
$$ language sql security definer stable;

-- Políticas usuarios
drop policy if exists "usuario ve su propio perfil" on usuarios;
drop policy if exists "admin gestiona usuarios" on usuarios;
create policy "usuario ve su propio perfil" on usuarios
  for select using (id = auth.uid());
create policy "admin gestiona usuarios" on usuarios
  for all using (mi_rol() = 'admin');

-- Políticas productos
drop policy if exists "ver productos del local" on productos;
drop policy if exists "admin importa productos" on productos;
create policy "ver productos del local" on productos
  for select using (local_id = mi_local());
create policy "admin importa productos" on productos
  for all using (mi_rol() = 'admin');

-- Políticas zonas
drop policy if exists "ver zonas del local" on zonas;
drop policy if exists "encargado gestiona zonas" on zonas;
create policy "ver zonas del local" on zonas
  for select using (local_id = mi_local());
create policy "encargado gestiona zonas" on zonas
  for all using (mi_rol() in ('encargado','admin') and local_id = mi_local());

-- Políticas zona_productos
drop policy if exists "ver zona_productos" on zona_productos;
drop policy if exists "encargado gestiona zona_productos" on zona_productos;
create policy "ver zona_productos" on zona_productos
  for select using (
    exists (select 1 from zonas where id = zona_id and local_id = mi_local())
  );
create policy "encargado gestiona zona_productos" on zona_productos
  for all using (mi_rol() in ('encargado','admin'));

-- Políticas tareas
drop policy if exists "ver tareas del local" on tareas;
drop policy if exists "encargado crea tareas" on tareas;
drop policy if exists "encargado modifica tareas" on tareas;
drop policy if exists "vendedor completa sus tareas" on tareas;
create policy "ver tareas del local" on tareas
  for select using (
    local_id = mi_local() and (
      mi_rol() in ('encargado','supervisor','admin')
      or asignado_a = auth.uid()
    )
  );
create policy "encargado crea tareas" on tareas
  for insert with check (mi_rol() in ('encargado','admin') and local_id = mi_local());
create policy "encargado modifica tareas" on tareas
  for update using (mi_rol() in ('encargado','admin') and local_id = mi_local());
create policy "vendedor completa sus tareas" on tareas
  for update using (asignado_a = auth.uid())
  with check (asignado_a = auth.uid());

-- Políticas incidencias
drop policy if exists "ver incidencias del local" on incidencias;
drop policy if exists "vendedor reporta incidencia" on incidencias;
drop policy if exists "encargado gestiona incidencias" on incidencias;
create policy "ver incidencias del local" on incidencias
  for select using (
    local_id = mi_local() and (
      mi_rol() in ('encargado','supervisor','admin')
      or reportado_por = auth.uid()
    )
  );
create policy "vendedor reporta incidencia" on incidencias
  for insert with check (local_id = mi_local() and reportado_por = auth.uid());
create policy "encargado gestiona incidencias" on incidencias
  for update using (mi_rol() in ('encargado','admin') and local_id = mi_local());

-- 4. USUARIOS DE PRUEBA
-- ============================================================
-- Vendedor (creado via API): 15686375-c0d2-4017-889a-39af779a3bda
-- Encargado (creado via API): 857a2d14-352a-4641-a18f-f783571a1795
-- Supervisor y Admin: creados aquí directamente en auth.users

DO $$
DECLARE
  v_local_id  uuid;
  v_sup_id    uuid := gen_random_uuid();
  v_admin_id  uuid := gen_random_uuid();
  v_vendedor  uuid := '15686375-c0d2-4017-889a-39af779a3bda';
  v_encargado uuid := '857a2d14-352a-4641-a18f-f783571a1795';
BEGIN
  SELECT id INTO v_local_id FROM locales WHERE codigo_sucursal = '875';

  -- Confirmar emails de vendedor y encargado (ya existen en auth)
  UPDATE auth.users SET email_confirmed_at = now() WHERE id IN (v_vendedor, v_encargado);

  -- Crear supervisor en auth.users (si no existe)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'supervisor@grimoldi.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, confirmation_token, recovery_token
    ) VALUES (
      v_sup_id,
      '00000000-0000-0000-0000-000000000000',
      'supervisor@grimoldi.com',
      crypt('test1234', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"email":"supervisor@grimoldi.com","email_verified":true}',
      'authenticated', 'authenticated', '', ''
    );
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      created_at, updated_at, last_sign_in_at
    ) VALUES (
      gen_random_uuid(), v_sup_id,
      jsonb_build_object('sub', v_sup_id::text, 'email', 'supervisor@grimoldi.com', 'email_verified', true),
      'email', 'supervisor@grimoldi.com',
      now(), now(), now()
    );
  ELSE
    SELECT id INTO v_sup_id FROM auth.users WHERE email = 'supervisor@grimoldi.com';
    UPDATE auth.users SET email_confirmed_at = now() WHERE id = v_sup_id;
  END IF;

  -- Crear admin en auth.users (si no existe)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@grimoldi.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, confirmation_token, recovery_token
    ) VALUES (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@grimoldi.com',
      crypt('test1234', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"email":"admin@grimoldi.com","email_verified":true}',
      'authenticated', 'authenticated', '', ''
    );
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      created_at, updated_at, last_sign_in_at
    ) VALUES (
      gen_random_uuid(), v_admin_id,
      jsonb_build_object('sub', v_admin_id::text, 'email', 'admin@grimoldi.com', 'email_verified', true),
      'email', 'admin@grimoldi.com',
      now(), now(), now()
    );
  ELSE
    SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@grimoldi.com';
    UPDATE auth.users SET email_confirmed_at = now() WHERE id = v_admin_id;
  END IF;

  -- Insertar todos en tabla usuarios
  INSERT INTO usuarios (id, email, nombre, rol, local_id)
  VALUES (v_vendedor, 'vendedor@grimoldi.com', 'María', 'vendedor', v_local_id)
  ON CONFLICT (id) DO UPDATE SET local_id = v_local_id, rol = 'vendedor';

  INSERT INTO usuarios (id, email, nombre, rol, local_id)
  VALUES (v_encargado, 'encargado@grimoldi.com', 'Carlos', 'encargado', v_local_id)
  ON CONFLICT (id) DO UPDATE SET local_id = v_local_id, rol = 'encargado';

  INSERT INTO usuarios (id, email, nombre, rol, local_id)
  VALUES (v_sup_id, 'supervisor@grimoldi.com', 'Laura', 'supervisor', v_local_id)
  ON CONFLICT (id) DO UPDATE SET local_id = v_local_id, rol = 'supervisor';

  INSERT INTO usuarios (id, email, nombre, rol, local_id)
  VALUES (v_admin_id, 'admin@grimoldi.com', 'Admin', 'admin', v_local_id)
  ON CONFLICT (id) DO UPDATE SET local_id = v_local_id, rol = 'admin';

  RAISE NOTICE 'Setup completo. local_id = %', v_local_id;
  RAISE NOTICE 'supervisor_id = %', v_sup_id;
  RAISE NOTICE 'admin_id = %', v_admin_id;
END $$;
