-- ============================================================
-- Función RPC para actualizar el balance de tokens
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_token_balance(
  p_client_id uuid,
  p_tokens integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Actualizar el balance sumando los tokens
  UPDATE public.token_balances
  SET
    total_tokens = total_tokens + p_tokens,
    available_tokens = available_tokens + p_tokens,
    updated_at = NOW()
  WHERE client_id = p_client_id;

  -- Si no existe balance, crearlo
  IF NOT FOUND THEN
    INSERT INTO public.token_balances (
      client_id,
      total_tokens,
      used_tokens,
      available_tokens,
      is_active
    ) VALUES (
      p_client_id,
      p_tokens,
      0,
      p_tokens,
      true
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.update_token_balance IS
  'Actualiza el balance de tokens de un cliente. Si no existe, lo crea.';
