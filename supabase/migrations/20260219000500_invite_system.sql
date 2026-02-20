-- Sistema de invitaciones con token

ALTER TABLE public.client_members
ADD COLUMN IF NOT EXISTS invite_token uuid DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS invite_email text,
ADD COLUMN IF NOT EXISTS invited_at timestamptz,
ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_client_members_invite_token ON public.client_members(invite_token) WHERE status = 'pending';

COMMENT ON COLUMN public.client_members.invite_token IS 'Token único para aceptar invitación';
COMMENT ON COLUMN public.client_members.invite_email IS 'Email del usuario invitado (antes de registrarse)';
COMMENT ON COLUMN public.client_members.invited_at IS 'Fecha cuando se envió la invitación';
COMMENT ON COLUMN public.client_members.accepted_at IS 'Fecha cuando se aceptó la invitación';

-- Función para crear permisos por defecto según rol
CREATE OR REPLACE FUNCTION public.create_default_permissions_for_role(
  p_member_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Billing: gestión de facturación, tokens y visualización de uso
  IF p_role = 'billing' THEN
    INSERT INTO public.member_permissions (member_id, section, permissions) VALUES
      (p_member_id, 'overview', ARRAY['view']::section_permission[]),
      (p_member_id, 'agents', ARRAY['view']::section_permission[]),
      (p_member_id, 'wa-interactions', ARRAY['view']::section_permission[]),
      (p_member_id, 'wa-connections', ARRAY['view']::section_permission[]),
      (p_member_id, 'usage', ARRAY['view']::section_permission[]),
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

COMMENT ON FUNCTION public.create_default_permissions_for_role IS 'Crea permisos por defecto según el rol asignado: billing (facturación y tokens), viewer (solo lectura), agent-manager (gestión de agentes)';
