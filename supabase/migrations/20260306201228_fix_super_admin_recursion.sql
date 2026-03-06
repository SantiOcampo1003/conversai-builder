-- ============================================================
-- Fix: Recursion infinita en is_super_admin()
-- ============================================================
-- Problema: is_super_admin() hace SELECT a client_members,
-- pero las politicas RLS de client_members llaman a is_super_admin()
-- Esto causa recursion infinita.
--
-- Solucion: Almacenar el rol super_admin en auth.users.raw_user_meta_data
-- y verificar desde ahi sin tocar client_members
-- ============================================================

-- PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP
-- 1. Nueva funcion is_super_admin que NO consulta client_members
-- PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'is_super_admin')::boolean,
    false
  );
$$;

COMMENT ON FUNCTION public.is_super_admin() IS
  'Verifica si el usuario es super admin desde JWT metadata (evita recursion RLS)';


-- PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP
-- 2. Funcion helper para sincronizar super_admin a metadata
-- PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP
CREATE OR REPLACE FUNCTION public.sync_super_admin_to_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super boolean;
BEGIN
  -- Determinar si el usuario es super_admin
  v_is_super := (NEW.role = 'super_admin' AND NEW.status = 'active');

  -- Actualizar metadata en auth.users
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) ||
      jsonb_build_object('is_super_admin', v_is_super)
  WHERE id = NEW.auth_user_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_super_admin_to_metadata() IS
  'Sincroniza el rol super_admin al user metadata para evitar queries recursivos en RLS';


-- PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP
-- 3. Trigger para mantener metadata sincronizada
-- PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP
DROP TRIGGER IF EXISTS sync_super_admin_metadata_on_insert ON public.client_members;
DROP TRIGGER IF EXISTS sync_super_admin_metadata_on_update ON public.client_members;

CREATE TRIGGER sync_super_admin_metadata_on_insert
  AFTER INSERT ON public.client_members
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_super_admin_to_metadata();

CREATE TRIGGER sync_super_admin_metadata_on_update
  AFTER UPDATE ON public.client_members
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role OR OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sync_super_admin_to_metadata();


-- PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP
-- 4. Sincronizar super_admins existentes
-- PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) ||
    jsonb_build_object('is_super_admin', true)
WHERE id IN (
  SELECT auth_user_id
  FROM public.client_members
  WHERE role = 'super_admin'
    AND status = 'active'
);

-- Limpiar flag de usuarios que YA NO son super_admin
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) ||
    jsonb_build_object('is_super_admin', false)
WHERE id NOT IN (
  SELECT auth_user_id
  FROM public.client_members
  WHERE role = 'super_admin'
    AND status = 'active'
)
AND (raw_user_meta_data->>'is_super_admin')::boolean = true;
