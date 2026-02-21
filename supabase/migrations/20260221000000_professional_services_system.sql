-- ============================================================
-- Sistema de Servicios Profesionales
-- Permite a super admins crear y gestionar órdenes de servicios
-- para clientes (implementaciones, customizaciones, etc.)
-- ============================================================


-- ============================================================
-- 1. CATÁLOGO DE SERVICIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.services (
  id              uuid DEFAULT gen_random_uuid() NOT NULL,
  name            varchar(100) NOT NULL,
  display_name    varchar(150) NOT NULL,
  description     text,
  price_cop       integer NOT NULL,
  price_usd       numeric(10,2),
  service_type    varchar(50) NOT NULL,
  estimated_hours integer,
  features        jsonb DEFAULT '[]'::jsonb,
  active          boolean DEFAULT true,
  sort_order      integer DEFAULT 0,
  created_at      timestamp with time zone DEFAULT now(),
  updated_at      timestamp with time zone DEFAULT now(),

  CONSTRAINT services_pkey PRIMARY KEY (id),
  CONSTRAINT services_name_key UNIQUE (name),
  CONSTRAINT services_type_check
    CHECK (service_type IN ('implementation', 'customization', 'training', 'support', 'addon'))
);

ALTER TABLE public.services OWNER TO postgres;

CREATE INDEX IF NOT EXISTS idx_services_type ON public.services(service_type);
CREATE INDEX IF NOT EXISTS idx_services_active ON public.services(active);


-- ============================================================
-- 2. ÓRDENES DE SERVICIO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_orders (
  id                        uuid DEFAULT gen_random_uuid() NOT NULL,
  service_id                uuid NOT NULL,
  client_id                 uuid NOT NULL,
  assigned_to               uuid,

  -- Detalles personalizados
  custom_description        text,
  deliverables              jsonb DEFAULT '[]'::jsonb,
  price_cop                 integer NOT NULL,
  price_usd                 numeric(10,2),
  estimated_completion_date date,

  -- Estados
  payment_status            varchar(20) NOT NULL DEFAULT 'pending',
  service_status            varchar(20) NOT NULL DEFAULT 'not_started',

  -- Información de pago
  payment_id                varchar(100),
  mercadopago_preference_id varchar(100),
  paid_at                   timestamp with time zone,

  -- Metadata
  metadata                  jsonb DEFAULT '{}'::jsonb,
  created_at                timestamp with time zone DEFAULT now(),
  updated_at                timestamp with time zone DEFAULT now(),
  completed_at              timestamp with time zone,

  CONSTRAINT service_orders_pkey PRIMARY KEY (id),
  CONSTRAINT service_orders_service_fkey
    FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT,
  CONSTRAINT service_orders_client_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE,
  CONSTRAINT service_orders_assigned_fkey
    FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT service_orders_payment_status_check
    CHECK (payment_status IN ('pending', 'paid', 'cancelled', 'refunded')),
  CONSTRAINT service_orders_service_status_check
    CHECK (service_status IN ('not_started', 'in_progress', 'completed', 'cancelled', 'on_hold'))
);

ALTER TABLE public.service_orders OWNER TO postgres;

CREATE INDEX IF NOT EXISTS idx_service_orders_client_id ON public.service_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_service_id ON public.service_orders(service_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_assigned_to ON public.service_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_service_orders_payment_status ON public.service_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_service_orders_service_status ON public.service_orders(service_status);
CREATE INDEX IF NOT EXISTS idx_service_orders_payment_id ON public.service_orders(payment_id);


-- ============================================================
-- 3. COMENTARIOS/NOTAS DEL SERVICIO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_comments (
  id               uuid DEFAULT gen_random_uuid() NOT NULL,
  service_order_id uuid NOT NULL,
  author_id        uuid NOT NULL,
  author_type      varchar(20) NOT NULL,
  comment          text NOT NULL,
  is_internal      boolean DEFAULT false,
  created_at       timestamp with time zone DEFAULT now(),

  CONSTRAINT service_comments_pkey PRIMARY KEY (id),
  CONSTRAINT service_comments_order_fkey
    FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE,
  CONSTRAINT service_comments_author_fkey
    FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT service_comments_author_type_check
    CHECK (author_type IN ('client', 'admin', 'system'))
);

ALTER TABLE public.service_comments OWNER TO postgres;

CREATE INDEX IF NOT EXISTS idx_service_comments_order_id ON public.service_comments(service_order_id);
CREATE INDEX IF NOT EXISTS idx_service_comments_author_id ON public.service_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_service_comments_is_internal ON public.service_comments(is_internal);


-- ============================================================
-- 4. ENTREGABLES DEL SERVICIO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_deliverables (
  id               uuid DEFAULT gen_random_uuid() NOT NULL,
  service_order_id uuid NOT NULL,
  title            varchar(255) NOT NULL,
  description      text,
  status           varchar(20) NOT NULL DEFAULT 'pending',
  sort_order       integer DEFAULT 0,
  created_at       timestamp with time zone DEFAULT now(),
  updated_at       timestamp with time zone DEFAULT now(),
  completed_at     timestamp with time zone,

  CONSTRAINT service_deliverables_pkey PRIMARY KEY (id),
  CONSTRAINT service_deliverables_order_fkey
    FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE,
  CONSTRAINT service_deliverables_status_check
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

ALTER TABLE public.service_deliverables OWNER TO postgres;

CREATE INDEX IF NOT EXISTS idx_service_deliverables_order_id ON public.service_deliverables(service_order_id);
CREATE INDEX IF NOT EXISTS idx_service_deliverables_status ON public.service_deliverables(status);


-- ============================================================
-- 5. TRIGGERS
-- ============================================================
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_orders_updated_at
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_deliverables_updated_at
  BEFORE UPDATE ON public.service_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- 6. FUNCIÓN HELPER: Detectar super admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_members cm
    JOIN auth.users u ON u.id = cm.auth_user_id
    WHERE cm.auth_user_id = auth.uid()
      AND cm.role = 'super_admin'
      AND cm.status = 'active'
      AND u.email LIKE '%@easyagents.space'
  );
$$;

COMMENT ON FUNCTION public.is_super_admin IS 'Retorna true si el usuario actual es super_admin con dominio @easyagents.space';


-- ============================================================
-- 7. RLS (Row Level Security)
-- ============================================================
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_deliverables ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════
-- SERVICES: Lectura pública, gestión solo super_admin
-- ══════════════════════════════════════════════════════════
CREATE POLICY "anyone_can_view_active_services"
  ON public.services FOR SELECT
  USING (active = true);

CREATE POLICY "super_admin_can_manage_services"
  ON public.services FOR ALL
  USING (public.is_super_admin());

-- ══════════════════════════════════════════════════════════
-- SERVICE ORDERS: Clientes ven propias, super_admin ve todas
-- ══════════════════════════════════════════════════════════
CREATE POLICY "clients_can_view_own_orders"
  ON public.service_orders FOR SELECT
  USING (
    client_id IN (SELECT public.get_my_client_ids())
    OR public.is_super_admin()
  );

CREATE POLICY "super_admin_can_manage_orders"
  ON public.service_orders FOR ALL
  USING (public.is_super_admin());

-- ══════════════════════════════════════════════════════════
-- SERVICE COMMENTS: Visibilidad según tipo
-- ══════════════════════════════════════════════════════════
CREATE POLICY "users_can_view_order_comments"
  ON public.service_comments FOR SELECT
  USING (
    (
      service_order_id IN (
        SELECT id FROM public.service_orders
        WHERE client_id IN (SELECT public.get_my_client_ids())
      )
      AND (is_internal = false OR public.is_super_admin())
    )
    OR public.is_super_admin()
  );

CREATE POLICY "users_can_create_comments"
  ON public.service_comments FOR INSERT
  WITH CHECK (
    service_order_id IN (
      SELECT id FROM public.service_orders
      WHERE client_id IN (SELECT public.get_my_client_ids())
        OR public.is_super_admin()
    )
  );

CREATE POLICY "super_admin_can_manage_comments"
  ON public.service_comments FOR ALL
  USING (public.is_super_admin());

-- ══════════════════════════════════════════════════════════
-- SERVICE DELIVERABLES: Clientes ven propios, super_admin gestiona
-- ══════════════════════════════════════════════════════════
CREATE POLICY "users_can_view_order_deliverables"
  ON public.service_deliverables FOR SELECT
  USING (
    service_order_id IN (
      SELECT id FROM public.service_orders
      WHERE client_id IN (SELECT public.get_my_client_ids())
    )
    OR public.is_super_admin()
  );

CREATE POLICY "super_admin_can_manage_deliverables"
  ON public.service_deliverables FOR ALL
  USING (public.is_super_admin());


-- ============================================================
-- 8. GRANTS
-- ============================================================
GRANT ALL ON TABLE public.services TO anon;
GRANT ALL ON TABLE public.services TO authenticated;
GRANT ALL ON TABLE public.services TO service_role;

GRANT ALL ON TABLE public.service_orders TO anon;
GRANT ALL ON TABLE public.service_orders TO authenticated;
GRANT ALL ON TABLE public.service_orders TO service_role;

GRANT ALL ON TABLE public.service_comments TO anon;
GRANT ALL ON TABLE public.service_comments TO authenticated;
GRANT ALL ON TABLE public.service_comments TO service_role;

GRANT ALL ON TABLE public.service_deliverables TO anon;
GRANT ALL ON TABLE public.service_deliverables TO authenticated;
GRANT ALL ON TABLE public.service_deliverables TO service_role;


-- ============================================================
-- 9. COMENTARIOS
-- ============================================================
COMMENT ON TABLE public.services IS 'Catálogo de servicios profesionales disponibles';
COMMENT ON TABLE public.service_orders IS 'Órdenes de servicios específicas para cada cliente';
COMMENT ON TABLE public.service_comments IS 'Comentarios y comunicación sobre órdenes de servicio';
COMMENT ON TABLE public.service_deliverables IS 'Entregables/tareas específicas de cada orden de servicio';

COMMENT ON COLUMN public.service_orders.payment_status IS 'Estado del pago: pending, paid, cancelled, refunded';
COMMENT ON COLUMN public.service_orders.service_status IS 'Estado del servicio: not_started, in_progress, completed, cancelled, on_hold';
COMMENT ON COLUMN public.service_comments.is_internal IS 'Si es true, solo visible para admins';
COMMENT ON COLUMN public.services.features IS 'Array JSON de características incluidas en el servicio';
COMMENT ON COLUMN public.service_orders.deliverables IS 'Array JSON de entregables pactados';
