-- Función pública para obtener el email de una invitación sin autenticación
-- Solo retorna el email, no información sensible
CREATE OR REPLACE FUNCTION public.get_invite_email_by_token(p_token uuid)
RETURNS TABLE (invite_email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT cm.invite_email::text
  FROM client_members cm
  WHERE cm.invite_token = p_token
    AND cm.status = 'pending'
  LIMIT 1;
END;
$$;

-- Permitir acceso público (sin autenticación)
REVOKE ALL ON FUNCTION public.get_invite_email_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_email_by_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invite_email_by_token(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_invite_email_by_token IS 'Obtiene el email de una invitación pendiente por token (acceso público para pre-cargar en login)';
