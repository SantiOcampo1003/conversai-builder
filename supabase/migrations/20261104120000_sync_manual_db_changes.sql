-- ============================================================
-- Sincroniza cambios de esquema que se aplicaron en producción
-- directamente por SQL (sin pasar por `supabase db push`):
--   - Archivos del agente (agent_assets, agent_asset_sends, bucket agent-assets)
--   - Integración Google Sheets (agent_integrations)
--   - Datos a recoger por agente (agents.data_fields)
--   - Avisos al completar contacto (agent_notifications,
--     agent_notification_recipients, notification_log, leads.notified_at)
--
-- Es idempotente: en producción se marca como aplicada con
-- `supabase migration repair --status applied 20261104120000`
-- y en entornos nuevos crea los objetos desde cero.
-- ============================================================

-- ------------------------------------------------------------
-- Funciones auxiliares
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agent_client_id(p_agent_id text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT client_id FROM public.agents WHERE agent_id = p_agent_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_members
    WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_agent(p_agent_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM public.client_members m
    WHERE m.auth_user_id = auth.uid()
      AND m.client_id = public.agent_client_id(p_agent_id)
      AND m.status = 'active'
      AND m.role IN ('admin', 'agent-manager')
  );
$$;

-- ------------------------------------------------------------
-- Columnas nuevas en tablas existentes
-- ------------------------------------------------------------
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS data_fields jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS notified_at timestamp with time zone;

-- ------------------------------------------------------------
-- Archivos del agente
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_id character varying(255) NOT NULL,
  asset_key character varying(100) NOT NULL,
  kind character varying(20) NOT NULL,
  title character varying(255) NOT NULL,
  caption text,
  send_when text,
  product_id character varying(100),
  storage_path text NOT NULL,
  public_url text NOT NULL,
  file_name character varying(255),
  mime_type character varying(100),
  size_bytes bigint,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT agent_assets_pkey PRIMARY KEY (id),
  CONSTRAINT agent_assets_unique_key UNIQUE (agent_id, asset_key),
  CONSTRAINT agent_assets_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(agent_id) ON DELETE CASCADE,
  CONSTRAINT agent_assets_key_format CHECK ((asset_key)::text ~ '^[a-z0-9_]{1,100}$'),
  CONSTRAINT agent_assets_kind_check CHECK ((kind)::text = ANY (ARRAY['image', 'document'])),
  CONSTRAINT agent_assets_product_only_images CHECK (product_id IS NULL OR (kind)::text = 'image'),
  CONSTRAINT agent_assets_send_when_required CHECK (
    ((kind)::text = 'image' AND product_id IS NOT NULL)
    OR (send_when IS NOT NULL AND length(btrim(send_when)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_agent_assets_agent_id ON public.agent_assets (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_assets_product ON public.agent_assets (agent_id, product_id);

ALTER TABLE public.agent_assets ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS agent_assets_updated_at ON public.agent_assets;
CREATE TRIGGER agent_assets_updated_at
  BEFORE UPDATE ON public.agent_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "admins can manage agent assets" ON public.agent_assets;
CREATE POLICY "admins can manage agent assets" ON public.agent_assets
  FOR ALL TO authenticated
  USING (public.is_admin_of_client(public.agent_client_id(agent_id::text)) OR public.is_platform_admin())
  WITH CHECK (public.is_admin_of_client(public.agent_client_id(agent_id::text)) OR public.is_platform_admin());

DROP POLICY IF EXISTS "members can view agent assets" ON public.agent_assets;
CREATE POLICY "members can view agent assets" ON public.agent_assets
  FOR SELECT TO authenticated
  USING (public.agent_client_id(agent_id::text) IN (SELECT public.get_my_client_ids()) OR public.is_platform_admin());

CREATE TABLE IF NOT EXISTS public.agent_asset_sends (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  agent_id character varying(255) NOT NULL,
  user_id character varying(255) NOT NULL,
  asset_key character varying(100) NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT agent_asset_sends_pkey PRIMARY KEY (id),
  CONSTRAINT agent_asset_sends_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(agent_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_asset_sends_lookup ON public.agent_asset_sends (agent_id, user_id, asset_key);

ALTER TABLE public.agent_asset_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view asset sends" ON public.agent_asset_sends;
CREATE POLICY "members can view asset sends" ON public.agent_asset_sends
  FOR SELECT TO authenticated
  USING (public.agent_client_id(agent_id::text) IN (SELECT public.get_my_client_ids()) OR public.is_platform_admin());

-- ------------------------------------------------------------
-- Integración Google Sheets
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_id character varying(255) NOT NULL,
  provider character varying(30) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  spreadsheet_id text NOT NULL,
  sheet_name text NOT NULL DEFAULT 'Leads',
  last_sync_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT agent_integrations_pkey PRIMARY KEY (id),
  CONSTRAINT agent_integrations_agent_id_provider_key UNIQUE (agent_id, provider),
  CONSTRAINT agent_integrations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(agent_id) ON DELETE CASCADE,
  CONSTRAINT agent_integrations_provider_check CHECK ((provider)::text = 'google_sheets')
);

ALTER TABLE public.agent_integrations ADD COLUMN IF NOT EXISTS only_complete boolean NOT NULL DEFAULT true;

ALTER TABLE public.agent_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_integrations select" ON public.agent_integrations;
CREATE POLICY "agent_integrations select" ON public.agent_integrations
  FOR SELECT TO authenticated
  USING (public.agent_client_id(agent_id::text) IN (SELECT public.get_my_client_ids()) OR public.is_platform_admin());

DROP POLICY IF EXISTS "agent_integrations write" ON public.agent_integrations;
CREATE POLICY "agent_integrations write" ON public.agent_integrations
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM public.client_members m
      WHERE m.auth_user_id = auth.uid()
        AND m.client_id = public.agent_client_id(agent_integrations.agent_id::text)
        AND m.status::text = 'active'
        AND m.role::text = ANY (ARRAY['admin', 'agent-manager'])
    )
  )
  WITH CHECK (
    public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM public.client_members m
      WHERE m.auth_user_id = auth.uid()
        AND m.client_id = public.agent_client_id(agent_integrations.agent_id::text)
        AND m.status::text = 'active'
        AND m.role::text = ANY (ARRAY['admin', 'agent-manager'])
    )
  );

-- ------------------------------------------------------------
-- Avisos cuando un contacto queda completo
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_id character varying(255) NOT NULL,
  trigger character varying(30) NOT NULL DEFAULT 'lead_complete',
  enabled boolean NOT NULL DEFAULT true,
  message_template text NOT NULL,
  route_field character varying(100),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT agent_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT agent_notifications_agent_id_trigger_key UNIQUE (agent_id, trigger),
  CONSTRAINT agent_notifications_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(agent_id) ON DELETE CASCADE,
  CONSTRAINT agent_notifications_trigger_check CHECK ((trigger)::text = 'lead_complete')
);

ALTER TABLE public.agent_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_notifications select" ON public.agent_notifications;
CREATE POLICY "agent_notifications select" ON public.agent_notifications
  FOR SELECT TO authenticated
  USING (public.agent_client_id(agent_id::text) IN (SELECT public.get_my_client_ids()) OR public.is_platform_admin());

DROP POLICY IF EXISTS "agent_notifications write" ON public.agent_notifications;
CREATE POLICY "agent_notifications write" ON public.agent_notifications
  FOR ALL TO authenticated
  USING (public.can_manage_agent(agent_id::text))
  WITH CHECK (public.can_manage_agent(agent_id::text));

CREATE TABLE IF NOT EXISTS public.agent_notification_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL,
  match_value text,
  phone character varying(20) NOT NULL,
  label text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT agent_notification_recipients_pkey PRIMARY KEY (id),
  CONSTRAINT agent_notification_recipients_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.agent_notifications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS agent_notification_recipients_notification_idx ON public.agent_notification_recipients (notification_id);

ALTER TABLE public.agent_notification_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_notification_recipients select" ON public.agent_notification_recipients;
CREATE POLICY "agent_notification_recipients select" ON public.agent_notification_recipients
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agent_notifications n
      WHERE n.id = agent_notification_recipients.notification_id
        AND (public.agent_client_id(n.agent_id::text) IN (SELECT public.get_my_client_ids()) OR public.is_platform_admin())
    )
  );

DROP POLICY IF EXISTS "agent_notification_recipients write" ON public.agent_notification_recipients;
CREATE POLICY "agent_notification_recipients write" ON public.agent_notification_recipients
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agent_notifications n
      WHERE n.id = agent_notification_recipients.notification_id
        AND public.can_manage_agent(n.agent_id::text)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agent_notifications n
      WHERE n.id = agent_notification_recipients.notification_id
        AND public.can_manage_agent(n.agent_id::text)
    )
  );

CREATE TABLE IF NOT EXISTS public.notification_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_id character varying(255) NOT NULL,
  notification_id uuid,
  customer_id text NOT NULL,
  recipient_phone text NOT NULL,
  recipient_label text,
  status character varying(10) NOT NULL,
  error text,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_log_pkey PRIMARY KEY (id),
  CONSTRAINT notification_log_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(agent_id) ON DELETE CASCADE,
  CONSTRAINT notification_log_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.agent_notifications(id) ON DELETE SET NULL,
  CONSTRAINT notification_log_status_check CHECK ((status)::text = ANY (ARRAY['sent', 'failed']))
);

CREATE INDEX IF NOT EXISTS notification_log_agent_idx ON public.notification_log (agent_id, created_at DESC);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_log select" ON public.notification_log;
CREATE POLICY "notification_log select" ON public.notification_log
  FOR SELECT TO authenticated
  USING (public.can_manage_agent(agent_id::text));

-- ------------------------------------------------------------
-- Storage: bucket agent-assets (público, 20MB, imágenes y PDF)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agent-assets',
  'agent-assets',
  true,
  20971520,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- La primera carpeta de la ruta es el client_id del dueño del archivo
DROP POLICY IF EXISTS "agent assets: members list" ON storage.objects;
CREATE POLICY "agent assets: members list" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'agent-assets'
    AND ((storage.foldername(name))[1] IN (SELECT client_id::text FROM public.get_my_client_ids() AS get_my_client_ids(client_id))
      OR public.is_platform_admin())
  );

DROP POLICY IF EXISTS "agent assets: members upload" ON storage.objects;
CREATE POLICY "agent assets: members upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'agent-assets'
    AND ((storage.foldername(name))[1] IN (SELECT client_id::text FROM public.get_my_client_ids() AS get_my_client_ids(client_id))
      OR public.is_platform_admin())
  );

DROP POLICY IF EXISTS "agent assets: members update" ON storage.objects;
CREATE POLICY "agent assets: members update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'agent-assets'
    AND ((storage.foldername(name))[1] IN (SELECT client_id::text FROM public.get_my_client_ids() AS get_my_client_ids(client_id))
      OR public.is_platform_admin())
  );

DROP POLICY IF EXISTS "agent assets: members delete" ON storage.objects;
CREATE POLICY "agent assets: members delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'agent-assets'
    AND ((storage.foldername(name))[1] IN (SELECT client_id::text FROM public.get_my_client_ids() AS get_my_client_ids(client_id))
      OR public.is_platform_admin())
  );
