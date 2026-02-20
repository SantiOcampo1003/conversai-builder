-- ── User Feedback System ──────────────────────────────────────────────────
-- Sistema de feedback, reportes y reviews de usuarios

-- 1. Crear enum de tipos de feedback
DO $$ BEGIN
  CREATE TYPE feedback_type AS ENUM (
    'bug',
    'feedback',
    'review',
    'feature_request',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Crear enum de categorías
DO $$ BEGIN
  CREATE TYPE feedback_category AS ENUM (
    'chat',
    'dashboard',
    'agents',
    'tokens',
    'whatsapp',
    'general',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Crear enum de estados
DO $$ BEGIN
  CREATE TYPE feedback_status AS ENUM (
    'new',
    'in_review',
    'resolved',
    'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Tabla de feedback
CREATE TABLE IF NOT EXISTS user_feedback (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Usuario (puede ser null si no está autenticado)
  user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email             varchar(255),

  -- Clasificación
  type              feedback_type NOT NULL,
  category          feedback_category NOT NULL,
  rating            integer CHECK (rating >= 1 AND rating <= 5),

  -- Contenido
  subject           varchar(255) NOT NULL,
  message           text NOT NULL,

  -- Metadata adicional (agentId, page URL, browser info, etc)
  metadata          jsonb DEFAULT '{}',

  -- Estado
  status            feedback_status NOT NULL DEFAULT 'new',
  admin_notes       text,
  resolved_at       timestamptz,
  resolved_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Timestamps
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 5. Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON user_feedback(type);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON user_feedback(category);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON user_feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON user_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON user_feedback(rating);

-- 6. Trigger para updated_at
CREATE TRIGGER user_feedback_updated_at
  BEFORE UPDATE ON user_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. RLS Policies
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede insertar feedback (autenticado o no)
CREATE POLICY "Anyone can insert feedback"
  ON user_feedback
  FOR INSERT
  WITH CHECK (true);

-- Usuarios pueden ver su propio feedback
CREATE POLICY "Users can view their own feedback"
  ON user_feedback
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Solo admins (service_role) pueden ver todo y actualizar
-- Esto se maneja a nivel de servicio, no necesita policy aquí

-- 8. Comentarios para documentación
COMMENT ON TABLE user_feedback IS 'Sistema de feedback, reportes y reviews de usuarios';
COMMENT ON COLUMN user_feedback.type IS 'Tipo de feedback: bug, feedback, review, feature_request, other';
COMMENT ON COLUMN user_feedback.category IS 'Categoría/sección de la app donde se generó el feedback';
COMMENT ON COLUMN user_feedback.rating IS 'Calificación opcional de 1 a 5 estrellas';
COMMENT ON COLUMN user_feedback.metadata IS 'Información adicional como agentId, URL, browser, etc';
COMMENT ON COLUMN user_feedback.status IS 'Estado del feedback: new, in_review, resolved, closed';
