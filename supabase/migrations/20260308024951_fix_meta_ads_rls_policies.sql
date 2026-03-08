-- =====================================================
-- Migration: Fix Meta Ads RLS Policies
-- Description: Fix RLS policies to use is_super_admin() according to project standards
-- Date: 2024-03-08
-- =====================================================

-- 1. Drop incorrect meta_ads_config policies
DROP POLICY IF EXISTS "Super admin full access to meta_ads_config" ON meta_ads_config;
DROP POLICY IF EXISTS "Clients can view their own meta_ads_config" ON meta_ads_config;

-- 2. Create correct policies for meta_ads_config using the standard

-- SELECT: super_admin OR clients can view their own config
CREATE POLICY "view_meta_ads_config"
  ON meta_ads_config FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR agent_id IN (
      SELECT agent_id FROM agents WHERE client_id IN (SELECT public.get_my_client_ids())
    )
  );

-- INSERT: ONLY super_admin
CREATE POLICY "insert_meta_ads_config"
  ON meta_ads_config FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
  );

-- UPDATE: ONLY super_admin
CREATE POLICY "update_meta_ads_config"
  ON meta_ads_config FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
  );

-- DELETE: ONLY super_admin
CREATE POLICY "delete_meta_ads_config"
  ON meta_ads_config FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
  );

-- 3. Drop incorrect meta_ads_events policies
DROP POLICY IF EXISTS "Super admin can view all meta_ads_events" ON meta_ads_events;
DROP POLICY IF EXISTS "Clients can view their own meta_ads_events" ON meta_ads_events;

-- 4. Create correct policies for meta_ads_events using the standard

-- SELECT: super_admin OR clients can view events of their agents
CREATE POLICY "view_meta_ads_events"
  ON meta_ads_events FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR agent_id IN (
      SELECT agent_id FROM agents WHERE client_id IN (SELECT public.get_my_client_ids())
    )
  );

-- INSERT: Backend (service_role) or super_admin (for manual testing)
-- Note: Events are normally inserted from backend using service_role key
CREATE POLICY "insert_meta_ads_events"
  ON meta_ads_events FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
  );

-- UPDATE: ONLY super_admin (for manual corrections)
CREATE POLICY "update_meta_ads_events"
  ON meta_ads_events FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
  );

-- DELETE: ONLY super_admin (for cleanup)
CREATE POLICY "delete_meta_ads_events"
  ON meta_ads_events FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
  );

-- =====================================================

COMMENT ON POLICY "view_meta_ads_config" ON meta_ads_config IS 'Super admin sees all, clients see only their config';
COMMENT ON POLICY "insert_meta_ads_config" ON meta_ads_config IS 'Only super admin can create configs';
COMMENT ON POLICY "update_meta_ads_config" ON meta_ads_config IS 'Only super admin can modify configs';
COMMENT ON POLICY "delete_meta_ads_config" ON meta_ads_config IS 'Only super admin can delete configs';

COMMENT ON POLICY "view_meta_ads_events" ON meta_ads_events IS 'Super admin sees all, clients see events of their agents';
COMMENT ON POLICY "insert_meta_ads_events" ON meta_ads_events IS 'Only super admin or backend can insert events';
COMMENT ON POLICY "update_meta_ads_events" ON meta_ads_events IS 'Only super admin can modify events';
COMMENT ON POLICY "delete_meta_ads_events" ON meta_ads_events IS 'Only super admin can delete events';
