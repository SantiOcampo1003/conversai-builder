-- ============================================================
-- Fix: Corregir funci�n update_token_balance
-- Problema: available_tokens es una columna generada y no puede ser actualizada directamente
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
  -- NOTA: available_tokens es una columna generada, se calcula autom�ticamente
  UPDATE public.token_balances
  SET
    total_tokens = total_tokens + p_tokens,
    updated_at = NOW()
  WHERE client_id = p_client_id;

  -- Si no existe balance, crearlo
  IF NOT FOUND THEN
    INSERT INTO public.token_balances (
      client_id,
      total_tokens,
      used_tokens,
      is_active
    ) VALUES (
      p_client_id,
      p_tokens,
      0,
      true
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.update_token_balance IS
  'Actualiza el balance de tokens de un cliente. Si no existe, lo crea. available_tokens se calcula autom�ticamente.';
