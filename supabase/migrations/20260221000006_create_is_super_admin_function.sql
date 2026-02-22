-- ============================================================
-- Create is_super_admin() function
-- ============================================================
-- Esta función verifica si el usuario autenticado es super admin
-- Se usa en las políticas RLS para dar acceso completo
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar si el usuario actual tiene rol super_admin en client_members
  RETURN EXISTS (
    SELECT 1
    FROM public.client_members
    WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
      AND status = 'active'
  );
END;
$$;

COMMENT ON FUNCTION public.is_super_admin() IS 'Verifica si el usuario autenticado es un super admin activo';
