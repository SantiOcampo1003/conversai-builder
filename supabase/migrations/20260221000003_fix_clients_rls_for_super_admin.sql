-- ============================================================
-- Fix: Permitir que super_admin vea TODOS los clientes
-- ============================================================

-- Eliminar la política existente
DROP POLICY IF EXISTS "members_can_view_own_client" ON public.clients;

-- Recrear la política incluyendo super_admin
CREATE POLICY "members_can_view_own_client"
  ON public.clients FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR id IN (SELECT public.get_my_client_ids())
    OR public.is_super_admin()  -- ← SUPER ADMIN VE TODOS LOS CLIENTES
  );

COMMENT ON POLICY "members_can_view_own_client" ON public.clients IS
  'Los usuarios pueden ver: (1) clientes donde son auth_user_id directo, (2) clientes donde son miembros activos, (3) super_admin ve TODOS';
