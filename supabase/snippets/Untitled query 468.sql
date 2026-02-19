DROP POLICY IF EXISTS "members_can_view_own_client" ON public.clients;

  CREATE POLICY "members_can_view_own_client"
    ON public.clients FOR SELECT
    TO authenticated
    USING (
      auth_user_id = auth.uid()
      OR
      id IN (SELECT public.get_my_client_ids())
    );