-- ============================================================
-- FIX: corregir usuarios de prueba
-- Ejecutar en: https://supabase.com/dashboard/project/rnduzkdlanmbcxrqfria/sql
-- ============================================================

-- 1. Confirmar email de encargado (creado via API pero sin confirmación)
UPDATE auth.users
SET
  email_confirmed_at = now(),
  confirmed_at = now(),
  updated_at = now()
WHERE email = 'encargado@grimoldi.com';

-- 2. Corregir registros de supervisor y admin (campos NULL que rompen el login)
UPDATE auth.users
SET
  is_super_admin        = false,
  confirmation_token    = '',
  recovery_token        = '',
  email_change          = '',
  email_change_token_new     = '',
  email_change_token_current = '',
  phone_change          = '',
  phone_change_token    = '',
  reauthentication_token = '',
  email_confirmed_at    = now(),
  confirmed_at          = now(),
  updated_at            = now()
WHERE email IN ('supervisor@grimoldi.com', 'admin@grimoldi.com');

-- 3. Verificar que quedaron bien
SELECT email, email_confirmed_at IS NOT NULL as confirmado, role, aud
FROM auth.users
WHERE email IN (
  'vendedor@grimoldi.com',
  'encargado@grimoldi.com',
  'supervisor@grimoldi.com',
  'admin@grimoldi.com'
)
ORDER BY email;

-- 4. Verificar tabla usuarios
SELECT u.email, u.nombre, u.rol, l.nombre as local
FROM usuarios u
JOIN locales l ON l.id = u.local_id
ORDER BY u.rol;
