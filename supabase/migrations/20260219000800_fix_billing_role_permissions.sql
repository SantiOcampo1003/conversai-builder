-- Corregir permisos del rol 'billing' para que solo tenga acceso a tokens y account

-- Actualizar la función de permisos por defecto
CREATE OR REPLACE FUNCTION public.create_default_permissions_for_role(
  p_member_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Billing: solo tokens (comprar/ver) y account (ver su cuenta)
  IF p_role = 'billing' THEN
    INSERT INTO public.member_permissions (member_id, section, permissions) VALUES
      (p_member_id, 'tokens', ARRAY['view', 'edit']::section_permission[]),
      (p_member_id, 'account', ARRAY['view']::section_permission[])
    ON CONFLICT (member_id, section) DO NOTHING;

  -- Viewer: solo lectura en todo
  ELSIF p_role = 'viewer' THEN
    INSERT INTO public.member_permissions (member_id, section, permissions) VALUES
      (p_member_id, 'overview', ARRAY['view']::section_permission[]),
      (p_member_id, 'agents', ARRAY['view']::section_permission[]),
      (p_member_id, 'wa-interactions', ARRAY['view']::section_permission[]),
      (p_member_id, 'wa-connections', ARRAY['view']::section_permission[]),
      (p_member_id, 'usage', ARRAY['view']::section_permission[]),
      (p_member_id, 'tokens', ARRAY['view']::section_permission[]),
      (p_member_id, 'account', ARRAY['view']::section_permission[])
    ON CONFLICT (member_id, section) DO NOTHING;

  -- Agent Manager: gestión completa de agentes
  ELSIF p_role = 'agent-manager' THEN
    INSERT INTO public.member_permissions (member_id, section, permissions) VALUES
      (p_member_id, 'overview', ARRAY['view']::section_permission[]),
      (p_member_id, 'agents', ARRAY['view', 'edit', 'create', 'delete']::section_permission[]),
      (p_member_id, 'wa-interactions', ARRAY['view']::section_permission[]),
      (p_member_id, 'wa-connections', ARRAY['view']::section_permission[]),
      (p_member_id, 'usage', ARRAY['view']::section_permission[]),
      (p_member_id, 'account', ARRAY['view']::section_permission[])
    ON CONFLICT (member_id, section) DO NOTHING;
  END IF;
END;
$$;

-- Eliminar permisos incorrectos de usuarios con rol 'billing'
-- Solo deben tener acceso a 'tokens' y 'account'
DELETE FROM public.member_permissions
WHERE member_id IN (
  SELECT id FROM public.client_members WHERE role = 'billing'
)
AND section NOT IN ('tokens', 'account');

COMMENT ON FUNCTION public.create_default_permissions_for_role IS 'Crea permisos por defecto según el rol asignado: billing (solo tokens y account), viewer (solo lectura en todo), agent-manager (gestión de agentes)';
