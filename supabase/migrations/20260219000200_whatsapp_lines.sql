-- ── WhatsApp Lines ────────────────────────────────────────────────────────────
-- Gestión de líneas de WhatsApp conectadas via Evolution API (u otros providers)

-- 1. Agregar límite de líneas por cliente
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS max_whatsapp_lines integer NOT NULL DEFAULT 3;

-- 2. Crear enum de estados
DO $$ BEGIN
  CREATE TYPE whatsapp_line_status AS ENUM (
    'pending',
    'connected',
    'disconnected',
    'error'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Tabla de líneas de WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_lines (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  line_name               varchar(100) NOT NULL,
  phone_number            varchar(50),
  agent_id                varchar(255) REFERENCES agents(agent_id) ON DELETE SET NULL,
  status                  whatsapp_line_status NOT NULL DEFAULT 'pending',

  -- Evolution API específico
  evolution_instance_name varchar(255) NOT NULL UNIQUE,
  qr_code                 text,

  -- Metadata
  last_connected_at       timestamptz,
  error_message           text,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_whatsapp_lines_client_id ON whatsapp_lines(client_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_lines_agent_id ON whatsapp_lines(agent_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_lines_status ON whatsapp_lines(status);

-- Trigger updated_at
CREATE TRIGGER whatsapp_lines_updated_at
  BEFORE UPDATE ON whatsapp_lines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE whatsapp_lines ENABLE ROW LEVEL SECURITY;

-- Miembros del cliente pueden ver y gestionar sus líneas
CREATE POLICY "client members can view their lines"
  ON whatsapp_lines
  FOR SELECT
  TO authenticated
  USING (client_id IN (SELECT get_my_client_ids()));

-- Solo admin puede crear/actualizar/eliminar líneas
CREATE POLICY "admin can manage lines"
  ON whatsapp_lines
  FOR ALL
  TO authenticated
  USING (
    client_id IN (SELECT get_my_client_ids())
    AND is_admin_of_client(client_id)
  )
  WITH CHECK (
    is_admin_of_client(client_id)
  );

-- Función auxiliar para verificar límite de líneas antes de INSERT
CREATE OR REPLACE FUNCTION check_whatsapp_lines_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_count integer;
  v_max_allowed integer;
BEGIN
  -- Contar líneas actuales del cliente
  SELECT COUNT(*) INTO v_current_count
  FROM whatsapp_lines
  WHERE client_id = NEW.client_id;

  -- Obtener límite del cliente
  SELECT max_whatsapp_lines INTO v_max_allowed
  FROM clients
  WHERE id = NEW.client_id;

  -- Validar
  IF v_current_count >= v_max_allowed THEN
    RAISE EXCEPTION 'Límite de % líneas de WhatsApp alcanzado para este cliente', v_max_allowed;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger para validar límite antes de INSERT
CREATE TRIGGER check_lines_limit_before_insert
  BEFORE INSERT ON whatsapp_lines
  FOR EACH ROW
  EXECUTE FUNCTION check_whatsapp_lines_limit();
