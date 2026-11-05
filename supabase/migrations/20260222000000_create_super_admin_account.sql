-- ============================================================
-- Crear Cuenta de Super Admin en Producción
-- ============================================================
-- IMPORTANTE: Este script crea el cliente y membresía del super admin
-- El usuario de auth debe crearse manualmente en Supabase Dashboard
-- o mediante script separado con service_role key
-- ============================================================

-- 1. Crear cliente "EasyAgents Platform" para el super admin
INSERT INTO public.clients (
  id,
  name,
  email,
  phone,
  company_name,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'EasyAgents',
  'superadmin@easyagents.space',
  NULL,
  'EasyAgents Platform',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
-- 2. Comentario sobre el cliente
COMMENT ON TABLE public.clients IS 'Clientes de la plataforma. El cliente 00000000-0000-0000-0000-000000000000 es la cuenta del super admin.';
-- 3. Crear balance de tokens para super admin (ilimitado = 1,000,000)
INSERT INTO public.token_balances (
  id,
  client_id,
  total_tokens,
  used_tokens,
  is_active,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  1000000,  -- 1 millón de tokens
  0,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (client_id) DO NOTHING;
-- 4. Transacción de bienvenida de tokens
INSERT INTO public.token_transactions (
  id,
  client_id,
  type,
  tokens,
  description,
  payment_status,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'bonus',
  1000000,
  'Tokens ilimitados para super admin',
  'completed',
  NOW()
)
ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- PASO MANUAL: Crear usuario de autenticación
-- ============================================================
-- Después de aplicar esta migración, DEBES crear el usuario en:
-- Supabase Dashboard → Authentication → Users → Add User
--
-- Datos del usuario:
-- Email: superadmin@easyagents.space
-- Password: [USAR CONTRASEÑA SEGURA EN PRODUCCIÓN - NO Test1234!]
-- Email Confirmed: true
-- User Metadata: {"name": "EasyAgents Super Admin"}
--
-- Guardar el UUID generado para el siguiente paso
-- ============================================================

-- ============================================================
-- NOTA CRÍTICA SOBRE client_members
-- ============================================================
-- NO podemos insertar en client_members hasta que se cree el usuario
-- en auth.users. El UUID del usuario se genera automáticamente.
--
-- Después de crear el usuario en el Dashboard, ejecutar el script:
-- supabase/scripts/link_super_admin.sql
-- ============================================================