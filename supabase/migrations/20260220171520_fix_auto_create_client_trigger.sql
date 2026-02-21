-- Fix auto-create client trigger to prevent duplicates
-- Now checks if user already has a membership before creating a new client

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_user_name text;
  v_user_email text;
  v_pending_invite uuid;
  v_existing_membership uuid;
BEGIN
  v_user_email := NEW.email;
  v_user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(v_user_email, '@', 1));

  -- Verificar si el usuario ya tiene una membresía (ej: creada por el seed)
  SELECT id INTO v_existing_membership
  FROM public.client_members
  WHERE auth_user_id = NEW.id
  LIMIT 1;

  -- Si ya tiene membresía, no hacer nada
  IF v_existing_membership IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Verificar si existe una invitación pendiente para este email
  SELECT id INTO v_pending_invite
  FROM public.client_members
  WHERE invite_email = v_user_email
    AND status = 'pending'
  LIMIT 1;

  -- Si hay invitación pendiente, NO crear cliente automático
  -- El usuario se unirá al equipo cuando acepte la invitación
  IF v_pending_invite IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- No hay invitación pendiente ni membresía existente, crear cliente nuevo
  INSERT INTO public.clients (name, email, company_name, created_at)
  VALUES (
    v_user_name,
    v_user_email,
    v_user_name || ' Company',
    NOW()
  )
  RETURNING id INTO v_client_id;

  INSERT INTO public.client_members (client_id, auth_user_id, role, status, created_at)
  VALUES (
    v_client_id,
    NEW.id,
    'admin',
    'active',
    NOW()
  );

  INSERT INTO public.token_balances (client_id, total_tokens, used_tokens, is_active, created_at)
  VALUES (
    v_client_id,
    100,
    0,
    true,
    NOW()
  );

  INSERT INTO public.token_transactions (client_id, type, tokens, description, created_at)
  VALUES (
    v_client_id,
    'bonus',
    100,
    'Tokens de bienvenida',
    NOW()
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates client, admin member, and welcome tokens when a new user signs up (only if user does not already have a membership)';
