-- ============================================================
-- Sistema de Reintentos de Pago
-- ============================================================
-- Permite reintentar pagos pendientes y cancelar automáticamente
-- los que llevan más de 1 hora sin completarse
-- ============================================================

-- 1. Agregar columnas para gestión de pagos
ALTER TABLE public.token_transactions
  ADD COLUMN IF NOT EXISTS payment_link text,
  ADD COLUMN IF NOT EXISTS payment_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

COMMENT ON COLUMN public.token_transactions.payment_link IS 'Link de pago actual de MercadoPago (puede regenerarse)';
COMMENT ON COLUMN public.token_transactions.payment_expires_at IS 'Fecha cuando expira el pago (1 hora desde creación)';
COMMENT ON COLUMN public.token_transactions.cancelled_at IS 'Fecha de cancelación automática';
COMMENT ON COLUMN public.token_transactions.cancel_reason IS 'Razón de cancelación (timeout, usuario canceló, etc)';

-- 2. Índice para búsqueda eficiente de pagos expirados
CREATE INDEX IF NOT EXISTS idx_token_transactions_payment_expires
  ON public.token_transactions(payment_expires_at)
  WHERE payment_status = 'pending' AND payment_expires_at IS NOT NULL;

-- 3. Función para cancelar transacciones expiradas (más de 1 hora)
CREATE OR REPLACE FUNCTION public.cancel_expired_token_payments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancelled_count integer;
BEGIN
  -- Cancelar transacciones con payment_status = 'pending' que llevan más de 1 hora
  WITH cancelled_txs AS (
    UPDATE public.token_transactions
    SET
      payment_status = 'cancelled',
      cancelled_at = NOW(),
      cancel_reason = 'Payment timeout (1 hour expired)'
    WHERE payment_status = 'pending'
      AND type = 'purchase'
      AND payment_expires_at IS NOT NULL
      AND payment_expires_at < NOW()
      AND cancelled_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_cancelled_count FROM cancelled_txs;

  RETURN v_cancelled_count;
END;
$$;

COMMENT ON FUNCTION public.cancel_expired_token_payments() IS 'Cancela automáticamente transacciones de compra pendientes que llevan más de 1 hora';

-- 4. Actualizar transacciones existentes con fecha de expiración (1 hora desde creación)
UPDATE public.token_transactions
SET payment_expires_at = created_at + INTERVAL '1 hour'
WHERE type = 'purchase'
  AND payment_status = 'pending'
  AND payment_expires_at IS NULL;

-- ============================================================
-- 5. OPCIONAL: Configurar pg_cron (auto-cancelación cada hora)
-- ============================================================
-- Intentar habilitar pg_cron (puede fallar en algunos tiers de Supabase)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  -- Si se pudo crear la extensión, programar los jobs
  -- Cancelar pagos de tokens cada hora
  PERFORM cron.schedule(
    'cancel-expired-token-payments',
    '0 * * * *',
    $sql$SELECT cancel_expired_token_payments()$sql$
  );

  -- Cancelar pagos de servicios cada hora (5 minutos después)
  PERFORM cron.schedule(
    'cancel-expired-service-payments',
    '5 * * * *',
    $sql$SELECT cancel_expired_payment_links()$sql$
  );

  RAISE NOTICE '✅ pg_cron habilitado - Jobs programados para ejecutarse cada hora';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '⚠️ pg_cron no disponible - Usar cron de N8N como alternativa';
END $$;

COMMENT ON FUNCTION public.cancel_expired_token_payments() IS
  'Cancela automáticamente transacciones pendientes que llevan más de 1 hora. Se ejecuta cada hora via pg_cron o N8N.';
