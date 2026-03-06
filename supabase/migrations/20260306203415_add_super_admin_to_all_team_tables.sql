-- ============================================================
-- Add super_admin support to ALL team/permissions tables
-- ============================================================
-- Asegurar que is_super_admin() funcione en TODAS las tablas
-- relacionadas con equipos, permisos y membresias
-- ============================================================

-- PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP
-- MEMBER_PERMISSIONS
-- PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP

DROP POLICY IF EXISTS "admin can manage permissions" ON member_permissions;
DROP POLICY IF EXISTS "member can view own permissions" ON member_permissions;

-- SELECT: super_admin O miembros del cliente O el propio miembro
CREATE POLICY "view permissions"
  ON member_permissions FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR member_id IN (
      SELECT cm.id FROM client_members cm
      WHERE cm.client_id IN (SELECT public.get_my_client_ids())
    )
    OR member_id IN (
      SELECT id FROM client_members WHERE auth_user_id = auth.uid()
    )
  );

-- INSERT: super_admin O miembros del cliente
CREATE POLICY "insert permissions"
  ON member_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR member_id IN (
      SELECT cm.id FROM client_members cm
      WHERE cm.client_id IN (SELECT public.get_my_client_ids())
    )
  );

-- UPDATE: super_admin O miembros del cliente
CREATE POLICY "update permissions"
  ON member_permissions FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR member_id IN (
      SELECT cm.id FROM client_members cm
      WHERE cm.client_id IN (SELECT public.get_my_client_ids())
    )
  );

-- DELETE: super_admin O miembros del cliente
CREATE POLICY "delete permissions"
  ON member_permissions FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR member_id IN (
      SELECT cm.id FROM client_members cm
      WHERE cm.client_id IN (SELECT public.get_my_client_ids())
    )
  );
