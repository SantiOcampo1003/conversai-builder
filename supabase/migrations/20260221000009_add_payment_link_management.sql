-- ============================================================
-- Gestión de Links de Pago en Service Orders
-- ============================================================
-- Agrega columnas para guardar y gestionar links de pago
-- Permite reintentar pagos pendientes y cancelar órdenes
-- ============================================================

-- 1. Agregar columnas para links de pago
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS payment_link text,
  ADD COLUMN IF NOT EXISTS payment_link_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

-- 2. Comentarios
COMMENT ON COLUMN public.service_orders.payment_link IS 'Link de pago de Mercado Pago (guardado para poder reintentarlo)';
COMMENT ON COLUMN public.service_orders.payment_link_expires_at IS 'Fecha de expiración del link de pago (típicamente 24-72 horas)';
COMMENT ON COLUMN public.service_orders.cancelled_at IS 'Fecha y hora cuando se canceló la orden';
COMMENT ON COLUMN public.service_orders.cancel_reason IS 'Razón de cancelación (timeout, cliente canceló, etc)';

-- 3. Función para cancelar órdenes expiradas automáticamente
CREATE OR REPLACE FUNCTION public.cancel_expired_payment_links()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancelled_count integer;
BEGIN
  -- Cancelar órdenes con payment_status = 'pending' cuyo link expiró hace más de 24 horas
  WITH cancelled_orders AS (
    UPDATE public.service_orders
    SET
      payment_status = 'cancelled',
      cancelled_at = NOW(),
      cancel_reason = 'Payment link expired'
    WHERE payment_status = 'pending'
      AND payment_link_expires_at IS NOT NULL
      AND payment_link_expires_at < NOW() - INTERVAL '24 hours'
      AND cancelled_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_cancelled_count FROM cancelled_orders;

  RETURN v_cancelled_count;
END;
$$;

COMMENT ON FUNCTION public.cancel_expired_payment_links() IS 'Cancela automáticamente órdenes con links de pago expirados hace más de 24 horas';

-- 4. Índice para búsqueda eficiente de links expirados
CREATE INDEX IF NOT EXISTS idx_service_orders_payment_link_expires
  ON public.service_orders(payment_link_expires_at)
  WHERE payment_status = 'pending' AND payment_link_expires_at IS NOT NULL;
