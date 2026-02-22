-- Función que retorna los miembros del cliente con su email desde auth.users
-- SECURITY DEFINER para poder leer auth.users desde el cliente
CREATE OR REPLACE FUNCTION get_client_members_with_email()
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
SET search_path = ''
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  -- Obtener el client_id del usuario autenticado
  SELECT cm.client_id INTO v_client_id
  FROM public.client_members cm
  WHERE cm.auth_user_id = auth.uid()
    AND cm.status = 'active'
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN;
  END IF;

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
  ORDER BY cm.created_at DESC;
END;
$$;

-- Solo usuarios autenticados pueden llamarla
REVOKE ALL ON FUNCTION get_client_members_with_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_client_members_with_email() TO authenticated;
