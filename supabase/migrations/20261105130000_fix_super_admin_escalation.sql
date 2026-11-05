-- ============================================================
-- Seguridad: cerrar dos formas de volverse super admin o admin de otro cliente
--
-- 1. is_super_admin() leía user_metadata del JWT, que el propio usuario puede
--    cambiar con supabase.auth.updateUser({ data: { is_super_admin: true } }).
--    Ahora lee app_metadata, que solo se escribe con la service role.
-- 2. Las políticas de client_members dejaban que cualquier usuario se insertara
--    a sí mismo en cualquier cliente (con cualquier rol) y que cualquier miembro
--    cambiara roles. Ahora solo el admin del cliente o el super admin gestionan
--    miembros, y solo un super admin asigna o quita el rol super_admin.
--
-- Los super admins con sesión abierta recuperan el acceso al renovarse el token
-- (máximo 1 hora) o al volver a iniciar sesión.
-- ============================================================

-- ── 1. is_super_admin() desde app_metadata ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean, false);
$$;

COMMENT ON FUNCTION public.is_super_admin() IS
  'Super admin según app_metadata del JWT (solo lo escribe el servidor; evita recursión RLS en client_members)';

-- ── 2. Sincronizar el rol a app_metadata (y quitarlo de user_metadata) ─────────
CREATE OR REPLACE FUNCTION public.sync_super_admin_flag(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
        'is_super_admin',
        EXISTS (
          SELECT 1 FROM public.client_members
          WHERE auth_user_id = p_user_id AND role = 'super_admin' AND status = 'active'
        )
      ),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) - 'is_super_admin'
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_super_admin_flag(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_super_admin_to_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.sync_super_admin_flag(OLD.auth_user_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP = 'INSERT' OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id) THEN
    PERFORM public.sync_super_admin_flag(NEW.auth_user_id);
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.sync_super_admin_to_metadata() IS
  'Mantiene app_metadata.is_super_admin al día con client_members';

DROP TRIGGER IF EXISTS sync_super_admin_metadata_on_insert ON public.client_members;
DROP TRIGGER IF EXISTS sync_super_admin_metadata_on_update ON public.client_members;
DROP TRIGGER IF EXISTS sync_super_admin_metadata_on_delete ON public.client_members;

CREATE TRIGGER sync_super_admin_metadata_on_insert
  AFTER INSERT ON public.client_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_super_admin_to_metadata();

CREATE TRIGGER sync_super_admin_metadata_on_update
  AFTER UPDATE ON public.client_members
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role
        OR OLD.status IS DISTINCT FROM NEW.status
        OR OLD.auth_user_id IS DISTINCT FROM NEW.auth_user_id)
  EXECUTE FUNCTION public.sync_super_admin_to_metadata();

CREATE TRIGGER sync_super_admin_metadata_on_delete
  AFTER DELETE ON public.client_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_super_admin_to_metadata();

-- Pasar los super admins actuales a app_metadata y limpiar el flag de user_metadata de todos
UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'is_super_admin',
      EXISTS (
        SELECT 1 FROM public.client_members cm
        WHERE cm.auth_user_id = u.id AND cm.role = 'super_admin' AND cm.status = 'active'
      )
    ),
    raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb) - 'is_super_admin'
WHERE u.raw_user_meta_data ? 'is_super_admin'
   OR u.raw_app_meta_data ? 'is_super_admin'
   OR EXISTS (
     SELECT 1 FROM public.client_members cm
     WHERE cm.auth_user_id = u.id AND cm.role = 'super_admin' AND cm.status = 'active'
   );

-- ── 3. Solo un super admin asigna, cambia o quita el rol super_admin ───────────
-- Las llamadas del servidor (service role) y de funciones SECURITY DEFINER
-- (registro, aceptar invitación) no corren como "authenticated" y no se bloquean.
CREATE OR REPLACE FUNCTION public.guard_super_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_super_admin() THEN
    IF (TG_OP IN ('INSERT', 'UPDATE') AND NEW.role = 'super_admin')
       OR (TG_OP IN ('UPDATE', 'DELETE') AND OLD.role = 'super_admin') THEN
      RAISE EXCEPTION 'Solo un super admin puede asignar o modificar el rol super_admin'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS guard_super_admin_role ON public.client_members;
CREATE TRIGGER guard_super_admin_role
  BEFORE INSERT OR UPDATE OR DELETE ON public.client_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_super_admin_role();

-- ── 4. Políticas de client_members ─────────────────────────────────────────────
-- Antes había dos juegos de políticas permisivas que se sumaban (OR); se dejan solo estas.
DROP POLICY IF EXISTS "members_can_view_client_members" ON public.client_members;
DROP POLICY IF EXISTS "members_can_insert" ON public.client_members;
DROP POLICY IF EXISTS "admins_can_update_members" ON public.client_members;
DROP POLICY IF EXISTS "admins_can_delete_members" ON public.client_members;
DROP POLICY IF EXISTS "Users can view members from their client" ON public.client_members;
DROP POLICY IF EXISTS "Members can insert to their client" ON public.client_members;
DROP POLICY IF EXISTS "Members can update in their client" ON public.client_members;
DROP POLICY IF EXISTS "Members can delete from their client" ON public.client_members;
DROP POLICY IF EXISTS "client_members_select" ON public.client_members;
DROP POLICY IF EXISTS "client_members_insert" ON public.client_members;
DROP POLICY IF EXISTS "client_members_update" ON public.client_members;
DROP POLICY IF EXISTS "client_members_delete" ON public.client_members;

CREATE POLICY "client_members_select" ON public.client_members
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT public.get_my_client_ids()) OR public.is_super_admin());

-- Invitar: solo el admin del cliente (el registro y aceptar invitaciones van por funciones SECURITY DEFINER)
CREATE POLICY "client_members_insert" ON public.client_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_of_client(client_id) OR public.is_super_admin());

CREATE POLICY "client_members_update" ON public.client_members
  FOR UPDATE TO authenticated
  USING (public.is_admin_of_client(client_id) OR public.is_super_admin())
  WITH CHECK (public.is_admin_of_client(client_id) OR public.is_super_admin());

CREATE POLICY "client_members_delete" ON public.client_members
  FOR DELETE TO authenticated
  USING (public.is_admin_of_client(client_id) OR public.is_super_admin());
