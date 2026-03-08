-- =====================================================
-- Migration: Meta Ads Integration
-- Descripcion: Tablas para configuracion y tracking de eventos de Meta Ads
-- Fecha: 2024-03-08
-- =====================================================

-- 1. Tabla de configuracion de Meta Ads por agente
CREATE TABLE IF NOT EXISTS meta_ads_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,

  -- Configuracion del Pixel
  is_enabled BOOLEAN DEFAULT false,
  pixel_id TEXT,
  access_token TEXT,

  -- Test Mode
  test_mode BOOLEAN DEFAULT true,
  test_event_code TEXT,

  -- Eventos a trackear (JSONB array de objetos)
  tracked_events JSONB DEFAULT '[
    { "event": "Contact", "enabled": true, "max_per_user": 1, "description": "Primera interaccion del usuario" },
    { "event": "Lead", "enabled": true, "max_per_user": 2, "description": "Usuario muestra interes comercial" },
    { "event": "SubmitApplication", "enabled": true, "max_per_user": 1, "description": "Usuario solicita avanzar con compra" },
    { "event": "HotmartLinkSent", "enabled": true, "max_per_user": 3, "description": "Se comparte enlace de Hotmart" }
  ]'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: un agente = una configuracion
  CONSTRAINT unique_agent_meta_config UNIQUE (agent_id)
);

-- Indices para busqueda rapida
CREATE INDEX idx_meta_ads_config_agent_id ON meta_ads_config(agent_id);
CREATE INDEX idx_meta_ads_config_enabled ON meta_ads_config(is_enabled) WHERE is_enabled = true;

-- Comentarios
COMMENT ON TABLE meta_ads_config IS 'Configuracion de Meta Ads por agente (solo super admin)';
COMMENT ON COLUMN meta_ads_config.pixel_id IS 'ID del pixel de Meta Ads';
COMMENT ON COLUMN meta_ads_config.access_token IS 'Token de acceso encriptado (AES-256)';
COMMENT ON COLUMN meta_ads_config.test_mode IS 'Si true, eventos se registran pero NO se envian a Meta API';
COMMENT ON COLUMN meta_ads_config.test_event_code IS 'Codigo para ver eventos en Meta Test Events Tool';
COMMENT ON COLUMN meta_ads_config.tracked_events IS 'Array JSON de eventos configurados con limites';

-- =====================================================

-- 2. Tabla de eventos enviados a Meta Ads
CREATE TABLE IF NOT EXISTS meta_ads_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,

  -- Informacion del evento
  event_name TEXT NOT NULL,
  event_time TIMESTAMPTZ DEFAULT NOW(),

  -- Referencia a la conversacion/lead
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  chat_history_id UUID,

  -- Metadata del evento enviado a Meta
  meta_event_id TEXT,
  sent_successfully BOOLEAN DEFAULT false,
  error_message TEXT,
  was_test_event BOOLEAN DEFAULT false,

  -- Datos enviados (para debugging y auditoria)
  event_payload JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para busqueda rapida y prevencion de duplicados
CREATE INDEX idx_meta_ads_events_agent_user ON meta_ads_events(agent_id, user_id);
CREATE INDEX idx_meta_ads_events_event_name ON meta_ads_events(event_name);
CREATE INDEX idx_meta_ads_events_lead_id ON meta_ads_events(lead_id);
CREATE INDEX idx_meta_ads_events_created_at ON meta_ads_events(created_at DESC);
CREATE INDEX idx_meta_ads_events_sent_successfully ON meta_ads_events(sent_successfully);

-- Indice compuesto para contar eventos enviados exitosamente por usuario
CREATE INDEX idx_meta_ads_events_count
  ON meta_ads_events(agent_id, user_id, event_name, sent_successfully)
  WHERE sent_successfully = true;

-- Comentarios
COMMENT ON TABLE meta_ads_events IS 'Log de todos los eventos enviados a Meta Ads (auditoria y prevencion de duplicados)';
COMMENT ON COLUMN meta_ads_events.event_payload IS 'Payload JSON completo enviado a Meta Conversions API';
COMMENT ON COLUMN meta_ads_events.was_test_event IS 'True si se envio con test_event_code';

-- =====================================================

-- 3. Modificar tabla leads para agregar status de Meta Ads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS meta_ads_status JSONB DEFAULT '{}'::jsonb;

-- Indice GIN para busquedas rapidas en el campo JSONB
CREATE INDEX IF NOT EXISTS idx_leads_meta_ads_status
  ON leads USING GIN (meta_ads_status);

-- Comentario
COMMENT ON COLUMN leads.meta_ads_status IS 'Status de eventos de Meta Ads enviados para este lead';

-- =====================================================

-- 4. Row Level Security (RLS)

-- Habilitar RLS en meta_ads_config
ALTER TABLE meta_ads_config ENABLE ROW LEVEL SECURITY;

-- Policy: Super admin puede hacer TODO (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Super admin full access to meta_ads_config"
  ON meta_ads_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'super_admin'
    )
  );

-- Policy: Clientes pueden VER (read-only) su propia configuracion
CREATE POLICY "Clients can view their own meta_ads_config"
  ON meta_ads_config FOR SELECT
  USING (
    agent_id IN (
      SELECT agent_id FROM agents WHERE client_id = auth.uid()
    )
  );

-- Habilitar RLS en meta_ads_events
ALTER TABLE meta_ads_events ENABLE ROW LEVEL SECURITY;

-- Policy: Super admin puede ver todos los eventos
CREATE POLICY "Super admin can view all meta_ads_events"
  ON meta_ads_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'super_admin'
    )
  );

-- Policy: Clientes pueden ver solo los eventos de sus agentes
CREATE POLICY "Clients can view their own meta_ads_events"
  ON meta_ads_events FOR SELECT
  USING (
    agent_id IN (
      SELECT agent_id FROM agents WHERE client_id = auth.uid()
    )
  );

-- =====================================================

-- 5. Trigger para actualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_meta_ads_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_meta_ads_config_updated_at
  BEFORE UPDATE ON meta_ads_config
  FOR EACH ROW
  EXECUTE FUNCTION update_meta_ads_config_updated_at();

-- =====================================================

-- 6. Funcion auxiliar para contar eventos enviados
CREATE OR REPLACE FUNCTION count_meta_events_sent(
  p_agent_id TEXT,
  p_user_id TEXT,
  p_event_name TEXT
)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM meta_ads_events
  WHERE agent_id = p_agent_id
    AND user_id = p_user_id
    AND event_name = p_event_name
    AND sent_successfully = true;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION count_meta_events_sent IS 'Cuenta cuantos eventos de un tipo se han enviado exitosamente para un usuario';
