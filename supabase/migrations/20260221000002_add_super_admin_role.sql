-- ============================================================
-- Agregar rol super_admin a client_members
-- Este rol tiene acceso global a toda la plataforma
-- SOLO puede ser asignado a usuarios con dominio @easyagents.space
-- ============================================================

-- Actualizar constraint para incluir super_admin
ALTER TABLE public.client_members
  DROP CONSTRAINT IF EXISTS client_members_role_check;

ALTER TABLE public.client_members
  ADD CONSTRAINT client_members_role_check
  CHECK (role IN ('admin', 'billing', 'viewer', 'agent-manager', 'super_admin'));

COMMENT ON CONSTRAINT client_members_role_check ON public.client_members IS 'Roles disponibles: admin (acceso total al cliente), billing (facturación), viewer (solo lectura), agent-manager (gestión de agentes), super_admin (acceso global a toda la plataforma)';


-- ============================================================
-- Función de validación: super_admin solo para @easyagents.space
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_super_admin_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email text;
BEGIN
  -- Solo validar si el rol es super_admin
  IF NEW.role = 'super_admin' THEN
    -- Obtener el email del usuario
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = NEW.auth_user_id;

    -- Validar que el email termine en @easyagents.space
    IF v_user_email NOT LIKE '%@easyagents.space' THEN
      RAISE EXCEPTION 'El rol super_admin solo puede ser asignado a usuarios con dominio @easyagents.space. Email actual: %', v_user_email;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_super_admin_before_insert_update
  BEFORE INSERT OR UPDATE ON public.client_members
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_super_admin_domain();

COMMENT ON FUNCTION public.validate_super_admin_domain IS 'Validación de seguridad: el rol super_admin solo puede ser asignado a usuarios con email @easyagents.space';
