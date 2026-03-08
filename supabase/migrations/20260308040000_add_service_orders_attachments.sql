-- Add attachment_url field to service_orders table
ALTER TABLE public.service_orders
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

COMMENT ON COLUMN public.service_orders.attachment_url IS 'URL del archivo adjunto (cotización, contrato, etc.) almacenado en Supabase Storage';

-- Create storage bucket for service order attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-orders',
  'service-orders',
  false, -- Private bucket
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for service_orders bucket
-- Allow authenticated super admins to upload
CREATE POLICY "Super admins can upload service order attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'service-orders'
  AND public.is_super_admin()
);

-- Allow authenticated super admins to update
CREATE POLICY "Super admins can update service order attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'service-orders'
  AND public.is_super_admin()
);

-- Allow authenticated super admins to delete
CREATE POLICY "Super admins can delete service order attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'service-orders'
  AND public.is_super_admin()
);

-- Allow authenticated users to read if they own the order or are super admin
CREATE POLICY "Users can view their service order attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'service-orders'
  AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.service_orders so
      WHERE so.attachment_url = storage.objects.name
        AND so.client_id IN (SELECT public.get_my_client_ids())
    )
  )
);
