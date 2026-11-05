-- ============================================================
-- Líneas de WhatsApp por la API oficial de Meta (Cloud API)
-- junto a las actuales por QR (Evolution).
--   provider = 'evolution'  → evolution_instance_name obligatorio
--   provider = 'meta_cloud' → meta_phone_number_id obligatorio
-- ============================================================

ALTER TABLE public.whatsapp_lines
  ADD COLUMN IF NOT EXISTS provider varchar(20) NOT NULL DEFAULT 'evolution',
  ADD COLUMN IF NOT EXISTS meta_phone_number_id varchar(64),
  ADD COLUMN IF NOT EXISTS meta_waba_id varchar(64);

-- Las líneas de Meta no tienen instancia de Evolution
ALTER TABLE public.whatsapp_lines ALTER COLUMN evolution_instance_name DROP NOT NULL;

ALTER TABLE public.whatsapp_lines DROP CONSTRAINT IF EXISTS whatsapp_lines_provider_check;
ALTER TABLE public.whatsapp_lines
  ADD CONSTRAINT whatsapp_lines_provider_check CHECK (provider IN ('evolution', 'meta_cloud'));

ALTER TABLE public.whatsapp_lines DROP CONSTRAINT IF EXISTS whatsapp_lines_provider_ids_check;
ALTER TABLE public.whatsapp_lines
  ADD CONSTRAINT whatsapp_lines_provider_ids_check CHECK (
    (provider = 'evolution' AND evolution_instance_name IS NOT NULL)
    OR (provider = 'meta_cloud' AND meta_phone_number_id IS NOT NULL)
  );

-- El webhook de Meta identifica la línea por phone_number_id
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_lines_meta_phone_number_id_key
  ON public.whatsapp_lines (meta_phone_number_id)
  WHERE meta_phone_number_id IS NOT NULL;

COMMENT ON COLUMN public.whatsapp_lines.provider IS 'evolution (QR / WhatsApp Web) o meta_cloud (API oficial de Meta)';
COMMENT ON COLUMN public.whatsapp_lines.meta_phone_number_id IS 'Phone Number ID de la Cloud API de Meta (solo provider = meta_cloud)';
COMMENT ON COLUMN public.whatsapp_lines.meta_waba_id IS 'ID de la cuenta de WhatsApp Business (WABA) en Meta';
