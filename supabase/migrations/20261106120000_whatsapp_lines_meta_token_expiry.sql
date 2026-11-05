-- ============================================================
-- Vencimiento del token de Meta por línea (renovación automática)
--
-- Los tokens de Embedded Signup duran 60 días. El backend los renueva cada día
-- (cron del backend: llama a Meta y usa la llave de cifrado, ver
-- DEVELOPMENT_STANDARDS.md → Tareas Programadas) y guarda aquí la fecha nueva.
-- Si la renovación falla, deja el motivo para mostrarlo en el panel.
-- Ninguna de las dos es secreta: el navegador puede leerlas.
-- ============================================================

ALTER TABLE public.whatsapp_lines
  ADD COLUMN IF NOT EXISTS meta_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS meta_token_refresh_error text;

COMMENT ON COLUMN public.whatsapp_lines.meta_token_expires_at IS
  'Vencimiento del token de Meta del cliente. NULL = no vence, aún no consultado o la línea usa el token de la plataforma.';
COMMENT ON COLUMN public.whatsapp_lines.meta_token_refresh_error IS
  'Motivo del último fallo al renovar el token de Meta (NULL = sin problemas). El cliente debe reconectar con Facebook.';

GRANT SELECT (meta_token_expires_at, meta_token_refresh_error) ON public.whatsapp_lines TO authenticated;
