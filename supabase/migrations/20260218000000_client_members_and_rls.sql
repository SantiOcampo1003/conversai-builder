-- ============================================================
-- Migración: client_members + RLS fixes
-- Incluye:
--   1. Tabla client_members (roles y permisos por cliente)
--   2. Funciones SECURITY DEFINER (evitar recursión RLS)
--   3. Políticas RLS para client_members y clients
-- ============================================================


-- ============================================================
-- 1. TABLA client_members
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_members (
  id            uuid DEFAULT gen_random_uuid() NOT NULL,
  client_id     uuid NOT NULL,
  auth_user_id  uuid NOT NULL,
  role          varchar(50) NOT NULL DEFAULT 'admin',
  permissions   text[] DEFAULT NULL,
  -- NULL = usa los permisos del rol base (ver ROLE_PERMISSIONS en src/lib/permissions.ts)
  -- Si tiene valor, override completo para este usuario
  -- Formato: 'seccion:recurso:accion'
  -- Ejemplos:
  --   ARRAY['*']                                   → acceso total
  --   ARRAY['agents:*', 'tokens:view']             → todos agents + solo ver tokens
  --   ARRAY['agents:list', 'agents:view']          → solo lectura de agents
  --   ARRAY['whatsapp-interactions:*', 'usage:view']
  invited_by    uuid DEFAULT NULL,
  status        varchar(20) NOT NULL DEFAULT 'active',
  created_at    timestamp with time zone DEFAULT now(),
  updated_at    timestamp with time zone DEFAULT now(),

  CONSTRAINT client_members_pkey PRIMARY KEY (id),
  CONSTRAINT client_members_client_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE,
  CONSTRAINT client_members_unique_user_client
    UNIQUE (client_id, auth_user_id),
  CONSTRAINT client_members_role_check
    CHECK (role IN ('admin', 'collaborator', 'viewer', 'agent-administrator')),
  CONSTRAINT client_members_status_check
    CHECK (status IN ('active', 'invited', 'suspended'))
);

ALTER TABLE public.client_members OWNER TO postgres;

-- Índices
CREATE INDEX IF NOT EXISTS idx_client_members_client_id
  ON public.client_members (client_id);

CREATE INDEX IF NOT EXISTS idx_client_members_auth_user_id
  ON public.client_members (auth_user_id);

CREATE INDEX IF NOT EXISTS idx_client_members_status
  ON public.client_members (status);

-- Trigger updated_at
CREATE TRIGGER update_client_members_updated_at
  BEFORE UPDATE ON public.client_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- 2. FUNCIONES HELPER (SECURITY DEFINER = bypasea RLS)
--    Necesarias para evitar recursión infinita en políticas
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_client_ids()
RETURNS TABLE(client_id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT cm.client_id
  FROM public.client_members cm
  WHERE cm.auth_user_id = auth.uid()
    AND cm.status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.is_admin_of_client(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_members cm
    WHERE cm.client_id = p_client_id
      AND cm.auth_user_id = auth.uid()
      AND cm.role = 'admin'
      AND cm.status = 'active'
  );
$$;


-- ============================================================
-- 3. RLS EN client_members
-- ============================================================
ALTER TABLE public.client_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_client_members"
  ON public.client_members FOR SELECT
  USING (client_id IN (SELECT public.get_my_client_ids()));

CREATE POLICY "members_can_insert"
  ON public.client_members FOR INSERT
  WITH CHECK (
    auth_user_id = auth.uid()
    OR public.is_admin_of_client(client_id)
  );

CREATE POLICY "admins_can_update_members"
  ON public.client_members FOR UPDATE
  USING (public.is_admin_of_client(client_id));

CREATE POLICY "admins_can_delete_members"
  ON public.client_members FOR DELETE
  USING (public.is_admin_of_client(client_id));


-- ============================================================
-- 4. RLS EN clients
-- ============================================================
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- SELECT: miembro activo puede ver su cliente, o es el auth_user_id directo
CREATE POLICY "members_can_view_own_client"
  ON public.clients FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR id IN (SELECT public.get_my_client_ids())
  );

-- INSERT: cualquier usuario autenticado puede crear su cliente
CREATE POLICY "auth_users_can_create_client"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: solo admins del cliente
CREATE POLICY "admins_can_update_client"
  ON public.clients FOR UPDATE
  USING (public.is_admin_of_client(id));


-- ============================================================
-- 5. GRANTS
-- ============================================================
GRANT ALL ON TABLE public.client_members TO anon;
GRANT ALL ON TABLE public.client_members TO authenticated;
GRANT ALL ON TABLE public.client_members TO service_role;
