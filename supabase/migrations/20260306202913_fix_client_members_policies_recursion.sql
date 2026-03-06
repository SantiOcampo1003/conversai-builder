-- ============================================================
-- Fix: Recursion en politicas de client_members
-- ============================================================
-- Las politicas de INSERT/UPDATE/DELETE tienen EXISTS que
-- consultan client_members, causando recursion.
--
-- Solucion: Simplificar politicas para:
-- - Super admins: acceso completo (via is_super_admin que lee JWT)
-- - Miembros del cliente: confiar en la app para validar permisos
-- ============================================================

-- DROP existing policies
DROP POLICY IF EXISTS "Users can view members from their client" ON public.client_members;
DROP POLICY IF EXISTS "Admins can insert members to their client" ON public.client_members;
DROP POLICY IF EXISTS "Admins can update members from their client" ON public.client_members;
DROP POLICY IF EXISTS "Admins can delete members from their client" ON public.client_members;

-- SELECT: cualquier miembro activo puede ver miembros de su cliente
CREATE POLICY "Users can view members from their client"
  ON public.client_members FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT public.get_my_client_ids())
    OR public.is_super_admin()
  );

-- INSERT: super_admin O miembros del cliente pueden insertar
-- (la app valida que sean admin antes de llamar)
CREATE POLICY "Members can insert to their client"
  ON public.client_members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR client_id IN (SELECT public.get_my_client_ids())
    OR auth_user_id = auth.uid()  -- Auto-insercion
  );

-- UPDATE: super_admin O miembros del mismo cliente
CREATE POLICY "Members can update in their client"
  ON public.client_members FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR client_id IN (SELECT public.get_my_client_ids())
  );

-- DELETE: super_admin O miembros del mismo cliente
CREATE POLICY "Members can delete from their client"
  ON public.client_members FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR client_id IN (SELECT public.get_my_client_ids())
  );
