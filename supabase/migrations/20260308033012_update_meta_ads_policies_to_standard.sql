-- =====================================================
-- Migration: Update Meta Ads RLS Policies to Project Standard
-- Description: Allow clients to manage their own meta_ads_config (UI controls edit permissions)
-- Date: 2026-03-08
-- =====================================================

-- 1. Drop old restrictive policies
DROP POLICY IF EXISTS "view_meta_ads_config" ON meta_ads_config;
DROP POLICY IF EXISTS "insert_meta_ads_config" ON meta_ads_config;
DROP POLICY IF EXISTS "update_meta_ads_config" ON meta_ads_config;
DROP POLICY IF EXISTS "delete_meta_ads_config" ON meta_ads_config;

DROP POLICY IF EXISTS "view_meta_ads_events" ON meta_ads_events;
DROP POLICY IF EXISTS "insert_meta_ads_events" ON meta_ads_events;
DROP POLICY IF EXISTS "update_meta_ads_events" ON meta_ads_events;
DROP POLICY IF EXISTS "delete_meta_ads_events" ON meta_ads_events;

-- 2. Create standard policies for meta_ads_config

-- SELECT: super_admin OR client owns the agent
CREATE POLICY "view_meta_ads_config"
  ON meta_ads_config FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR agent_id IN (
      SELECT a.agent_id
      FROM agents a
      WHERE a.client_id IN (SELECT public.get_my_client_ids())
    )
  );

-- INSERT: super_admin OR client owns the agent
CREATE POLICY "insert_meta_ads_config"
  ON meta_ads_config FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR agent_id IN (
      SELECT a.agent_id
      FROM agents a
      WHERE a.client_id IN (SELECT public.get_my_client_ids())
    )
  );

-- UPDATE: super_admin OR client owns the agent
CREATE POLICY "update_meta_ads_config"
  ON meta_ads_config FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR agent_id IN (
      SELECT a.agent_id
      FROM agents a
      WHERE a.client_id IN (SELECT public.get_my_client_ids())
    )
  );

-- DELETE: super_admin OR client owns the agent
CREATE POLICY "delete_meta_ads_config"
  ON meta_ads_config FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR agent_id IN (
      SELECT a.agent_id
      FROM agents a
      WHERE a.client_id IN (SELECT public.get_my_client_ids())
    )
  );

-- 3. Create standard policies for meta_ads_events

-- SELECT: super_admin OR client owns the agent
CREATE POLICY "view_meta_ads_events"
  ON meta_ads_events FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR agent_id IN (
      SELECT a.agent_id
      FROM agents a
      WHERE a.client_id IN (SELECT public.get_my_client_ids())
    )
  );

-- INSERT: super_admin OR client owns the agent (backend inserts events)
CREATE POLICY "insert_meta_ads_events"
  ON meta_ads_events FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR agent_id IN (
      SELECT a.agent_id
      FROM agents a
      WHERE a.client_id IN (SELECT public.get_my_client_ids())
    )
  );

-- UPDATE: super_admin OR client owns the agent
CREATE POLICY "update_meta_ads_events"
  ON meta_ads_events FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR agent_id IN (
      SELECT a.agent_id
      FROM agents a
      WHERE a.client_id IN (SELECT public.get_my_client_ids())
    )
  );

-- DELETE: super_admin OR client owns the agent
CREATE POLICY "delete_meta_ads_events"
  ON meta_ads_events FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR agent_id IN (
      SELECT a.agent_id
      FROM agents a
      WHERE a.client_id IN (SELECT public.get_my_client_ids())
    )
  );

-- =====================================================

COMMENT ON POLICY "view_meta_ads_config" ON meta_ads_config IS 'Super admin OR client can view their own config';
COMMENT ON POLICY "insert_meta_ads_config" ON meta_ads_config IS 'Super admin OR client can insert config (UI restricts edit to super_admin)';
COMMENT ON POLICY "update_meta_ads_config" ON meta_ads_config IS 'Super admin OR client can update config (UI restricts edit to super_admin)';
COMMENT ON POLICY "delete_meta_ads_config" ON meta_ads_config IS 'Super admin OR client can delete config (UI restricts edit to super_admin)';

COMMENT ON POLICY "view_meta_ads_events" ON meta_ads_events IS 'Super admin OR client can view events of their agents';
COMMENT ON POLICY "insert_meta_ads_events" ON meta_ads_events IS 'Super admin OR client/backend can insert events';
COMMENT ON POLICY "update_meta_ads_events" ON meta_ads_events IS 'Super admin OR client can update events';
COMMENT ON POLICY "delete_meta_ads_events" ON meta_ads_events IS 'Super admin OR client can delete events';
