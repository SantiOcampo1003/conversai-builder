-- ============================================================
-- Token de negocio por línea de la API oficial (Embedded Signup)
--
-- Cada cliente que conecta su número con "Conectar con Facebook" entrega un
-- token de su propia cuenta de WhatsApp Business. El backend lo guarda cifrado
-- (AES-256-GCM) y lo usa para responder por esa línea.
--   meta_access_token_encrypted = NULL → la línea usa el token de la plataforma
--
-- El navegador no puede leer la columna: se pasa de permisos por tabla a
-- permisos por columna para anon/authenticated. Desde el navegador solo se
-- cambia el agente o el nombre de la línea; crear líneas va por el backend.
-- Una columna nueva en whatsapp_lines que deba leer el navegador necesita su GRANT.
-- ============================================================

ALTER TABLE public.whatsapp_lines
  ADD COLUMN IF NOT EXISTS meta_access_token_encrypted text;

COMMENT ON COLUMN public.whatsapp_lines.meta_access_token_encrypted IS
  'Token de negocio de Meta del cliente, cifrado por el backend (v1:iv:tag:data). NULL = token de la plataforma. No legible desde el navegador.';

REVOKE SELECT, INSERT, UPDATE ON public.whatsapp_lines FROM anon, authenticated;

GRANT SELECT (
  id, client_id, line_name, phone_number, agent_id, status, evolution_instance_name, qr_code,
  last_connected_at, error_message, created_at, updated_at, provider, meta_phone_number_id, meta_waba_id
) ON public.whatsapp_lines TO authenticated;

GRANT UPDATE (agent_id, line_name) ON public.whatsapp_lines TO authenticated;
