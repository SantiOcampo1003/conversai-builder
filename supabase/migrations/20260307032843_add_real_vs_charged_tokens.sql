-- Agregar columnas para diferenciar tokens reales (OpenAI) vs tokens cobrados (con markup)

-- 1. Agregar columnas a token_transactions
ALTER TABLE token_transactions
ADD COLUMN IF NOT EXISTS tokens_real bigint,
ADD COLUMN IF NOT EXISTS tokens_charged bigint,
ADD COLUMN IF NOT EXISTS markup_percentage integer;

-- 2. Comentarios para documentación
COMMENT ON COLUMN token_transactions.tokens_real IS 'Tokens reales consumidos por OpenAI (input + output + tools)';
COMMENT ON COLUMN token_transactions.tokens_charged IS 'Tokens cobrados al cliente (con markup aplicado)';
COMMENT ON COLUMN token_transactions.markup_percentage IS 'Porcentaje de markup aplicado (ej: 100 = cobrar el doble)';

-- 3. Migrar datos existentes (asumir que tokens antiguos son tokens_charged)
UPDATE token_transactions
SET
  tokens_charged = ABS(tokens),
  tokens_real = ABS(tokens),
  markup_percentage = 0
WHERE tokens_real IS NULL;

-- 4. Crear índice para reportes
CREATE INDEX IF NOT EXISTS idx_token_transactions_tokens_real
ON token_transactions(tokens_real)
WHERE type = 'consumption';

-- 5. Agregar constraint para validar que tokens_charged >= tokens_real
ALTER TABLE token_transactions
ADD CONSTRAINT chk_tokens_charged_gte_real
CHECK (
  tokens_charged IS NULL OR
  tokens_real IS NULL OR
  tokens_charged >= tokens_real
);

-- 6. Vista para reportes de rentabilidad
CREATE OR REPLACE VIEW token_profitability AS
SELECT
  client_id,
  agent_id,
  DATE(created_at) as date,
  COUNT(*) as transactions,
  SUM(ABS(tokens_real)) as total_tokens_real,
  SUM(ABS(tokens_charged)) as total_tokens_charged,
  SUM(ABS(tokens_charged) - ABS(tokens_real)) as total_profit_tokens,
  CASE
    WHEN SUM(ABS(tokens_real)) > 0
    THEN ROUND((SUM(ABS(tokens_charged) - ABS(tokens_real))::numeric / SUM(ABS(tokens_real))::numeric * 100), 2)
    ELSE 0
  END as profit_percentage
FROM token_transactions
WHERE type = 'consumption'
  AND tokens_real IS NOT NULL
  AND tokens_charged IS NOT NULL
GROUP BY client_id, agent_id, DATE(created_at)
ORDER BY date DESC;

COMMENT ON VIEW token_profitability IS 'Vista de rentabilidad: compara tokens reales vs cobrados por día';
