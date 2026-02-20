-- Función para aceptar una invitación pendiente
-- Permite que cualquier usuario autenticado acepte una invitación válida
CREATE OR REPLACE FUNCTION public.accept_team_invite(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_id uuid;
  v_client_id uuid;
  v_client_name text;
  v_role text;
  v_user_id uuid;
  v_existing_member uuid;
BEGIN
  -- Obtener el ID del usuario autenticado
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Buscar la invitación pendiente
  SELECT cm.id, cm.client_id, cm.role, c.name
  INTO v_invite_id, v_client_id, v_role, v_client_name
  FROM client_members cm
  JOIN clients c ON c.id = cm.client_id
  WHERE cm.invite_token = p_token
    AND cm.status = 'pending'
  LIMIT 1;

  -- Validar que la invitación existe
  IF v_invite_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid',
      'message', 'Esta invitación no es válida o ya fue usada'
    );
  END IF;

  -- Verificar si el usuario ya es miembro activo de este cliente
  SELECT id INTO v_existing_member
  FROM client_members
  WHERE client_id = v_client_id
    AND auth_user_id = v_user_id
    AND status = 'active'
  LIMIT 1;

  IF v_existing_member IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'already_member',
      'message', 'Ya eres miembro de este equipo'
    );
  END IF;

  -- Aceptar la invitación
  UPDATE client_members
  SET
    auth_user_id = v_user_id,
    status = 'active',
    accepted_at = NOW()
  WHERE id = v_invite_id;

  -- Retornar éxito con datos del cliente
  RETURN jsonb_build_object(
    'success', true,
    'client_name', v_client_name,
    'role', v_role
  );
END;
$$;

-- Permitir solo a usuarios autenticados
REVOKE ALL ON FUNCTION public.accept_team_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(uuid) TO authenticated;

COMMENT ON FUNCTION public.accept_team_invite IS 'Acepta una invitación de equipo pendiente y asocia la membresía al usuario autenticado';
