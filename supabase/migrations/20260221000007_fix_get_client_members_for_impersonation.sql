-- ============================================================
-- Fix get_client_members_with_email() para soportar impersonalización
-- ============================================================
-- Actualiza la función para que acepte un client_id como parámetro
-- Si no se pasa, usa el client_id del usuario autenticado (comportamiento actual)
-- Si se pasa, verifica que el usuario sea super_admin o miembro de ese cliente
-- ============================================================

DROP FUNCTION IF EXISTS public.get_client_members_with_email();

CREATE OR REPLACE FUNCTION public.get_client_members_with_email(
  p_client_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id            uuid,
  auth_user_id  uuid,
  role          text,
  status        text,
  email         text,
  full_name     text,
  invite_token  uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_is_super_admin boolean;
BEGIN
  -- Si no se proporciona client_id, obtener el del usuario autenticado
  IF p_client_id IS NULL THEN
    SELECT cm.client_id INTO v_client_id
    FROM public.client_members cm
    WHERE cm.auth_user_id = auth.uid()
      AND cm.status = 'active'
    LIMIT 1;
  ELSE
    -- Si se proporciona client_id, verificar que el usuario tenga acceso
    v_client_id := p_client_id;

    -- Verificar si es super admin
    SELECT public.is_super_admin() INTO v_is_super_admin;

    -- Si no es super admin, verificar que sea miembro del cliente
    IF NOT v_is_super_admin THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.client_members
        WHERE auth_user_id = auth.uid()
          AND client_id = v_client_id
          AND status = 'active'
      ) THEN
        -- No tiene acceso a este cliente
        RETURN;
      END IF;
    END IF;
  END IF;

  IF v_client_id IS NULL THEN
    RETURN;
  END IF;

  -- Retornar miembros del cliente con sus emails desde auth.users
  RETURN QUERY
  SELECT
    cm.id,
    cm.auth_user_id,
    cm.role::text,
    cm.status::text,
    COALESCE(u.email::text, cm.invite_email::text) AS email,
    COALESCE(u.raw_user_meta_data->>'name', u.email, cm.invite_email)::text AS full_name,
    cm.invite_token
  FROM public.client_members cm
  LEFT JOIN auth.users u ON u.id = cm.auth_user_id
  WHERE cm.client_id = v_client_id
    AND (cm.status = 'active' OR cm.status = 'pending')
  ORDER BY cm.created_at DESC;
END;
$$;

-- Solo usuarios autenticados pueden llamarla
REVOKE ALL ON FUNCTION public.get_client_members_with_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_members_with_email(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_client_members_with_email(uuid) IS 'Retorna miembros de un cliente con sus emails desde auth.users. Soporta impersonalización de super admin.';
