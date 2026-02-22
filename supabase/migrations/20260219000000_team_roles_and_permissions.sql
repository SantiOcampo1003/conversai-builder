-- ── Team roles & permissions ──────────────────────────────────────────────────
-- El campo `role` en client_members ya existe: 'admin' | 'billing' | 'viewer' | 'agent-manager'
-- Agregamos una tabla de permisos por sección para control granular.

-- Secciones del dashboard
DO $$ BEGIN
  CREATE TYPE dashboard_section AS ENUM (
    'overview',
    'agents',
    'wa-interactions',
    'wa-connections',
    'usage',
    'tokens',
    'account'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Permisos por sección
DO $$ BEGIN
  CREATE TYPE section_permission AS ENUM (
    'view',
    'edit',
    'create',
    'delete'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tabla de permisos por miembro
CREATE TABLE IF NOT EXISTS member_permissions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id   uuid NOT NULL REFERENCES client_members(id) ON DELETE CASCADE,
  section     dashboard_section NOT NULL,
  permissions section_permission[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, section)
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER member_permissions_updated_at
  BEFORE UPDATE ON member_permissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE member_permissions ENABLE ROW LEVEL SECURITY;

-- El admin del cliente puede ver y gestionar todos los permisos de su equipo
CREATE POLICY "admin can manage permissions"
  ON member_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_members cm
      WHERE cm.id = member_permissions.member_id
        AND cm.client_id IN (SELECT get_my_client_ids())
    )
    AND is_admin_of_client((
      SELECT cm.client_id FROM client_members cm WHERE cm.id = member_permissions.member_id LIMIT 1
    ))
  )
  WITH CHECK (
    is_admin_of_client((
      SELECT cm.client_id FROM client_members cm WHERE cm.id = member_permissions.member_id LIMIT 1
    ))
  );

-- Cada miembro puede ver sus propios permisos
CREATE POLICY "member can view own permissions"
  ON member_permissions
  FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM client_members WHERE auth_user_id = auth.uid()
    )
  );

-- Insertar permisos completos por defecto para el admin al crear un client_member admin
-- (Función helper para crear permisos por defecto)
CREATE OR REPLACE FUNCTION create_default_permissions(p_member_id uuid, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  all_sections dashboard_section[] := ARRAY[
    'overview', 'agents', 'wa-interactions', 'wa-connections',
    'usage', 'tokens', 'account'
  ]::dashboard_section[];
  all_perms section_permission[] := ARRAY['view','edit','create','delete']::section_permission[];
  view_only  section_permission[] := ARRAY['view']::section_permission[];
  s dashboard_section;
BEGIN
  FOREACH s IN ARRAY all_sections LOOP
    INSERT INTO member_permissions (member_id, section, permissions)
    VALUES (
      p_member_id,
      s,
      CASE WHEN p_role = 'admin' THEN all_perms ELSE view_only END
    )
    ON CONFLICT (member_id, section) DO NOTHING;
  END LOOP;
END;
$$;
