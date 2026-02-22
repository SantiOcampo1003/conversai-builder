-- ============================================================
-- Super Admin: Acceso completo a whatsapp_lines
-- ============================================================
-- Actualiza las políticas RLS de whatsapp_lines para que
-- el super admin pueda ver y gestionar todas las líneas
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "client members can view their lines" ON public.whatsapp_lines;
DROP POLICY IF EXISTS "admin can manage lines" ON public.whatsapp_lines;

-- Recreate with super admin access
CREATE POLICY "client members can view their lines"
  ON public.whatsapp_lines FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT public.get_my_client_ids())
    OR public.is_super_admin()
  );

CREATE POLICY "admin can manage lines"
  ON public.whatsapp_lines FOR ALL
  TO authenticated
  USING (
    (
      client_id IN (SELECT public.get_my_client_ids())
      AND public.is_admin_of_client(client_id)
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    public.is_admin_of_client(client_id)
    OR public.is_super_admin()
  );

COMMENT ON POLICY "client members can view their lines" ON public.whatsapp_lines IS
  'Miembros del cliente pueden ver sus líneas. Super admin puede ver todas.';

COMMENT ON POLICY "admin can manage lines" ON public.whatsapp_lines IS
  'Admins del cliente pueden gestionar sus líneas. Super admin puede gestionar todas.';
