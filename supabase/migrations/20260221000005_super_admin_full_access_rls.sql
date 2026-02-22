-- ============================================================
-- Super Admin: Acceso completo a todos los datos
-- ============================================================
-- Esta migración actualiza TODAS las políticas RLS para que
-- el super admin pueda ver y editar datos de cualquier cliente
-- cuando está impersonalizando.
-- ============================================================

-- ══════════════════════════════════════════════════════════
-- AGENTS
-- ══════════════════════════════════════════════════════════

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view agents from their client" ON public.agents;
DROP POLICY IF EXISTS "Users can insert agents for their client" ON public.agents;
DROP POLICY IF EXISTS "Users can update agents from their client" ON public.agents;
DROP POLICY IF EXISTS "Users can delete agents from their client" ON public.agents;

-- Recreate with super admin access
CREATE POLICY "Users can view agents from their client"
  ON public.agents FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT public.get_my_client_ids())
    OR public.is_super_admin()
  );

CREATE POLICY "Users can insert agents for their client"
  ON public.agents FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (SELECT public.get_my_client_ids())
    OR public.is_super_admin()
  );

CREATE POLICY "Users can update agents from their client"
  ON public.agents FOR UPDATE
  TO authenticated
  USING (
    client_id IN (SELECT public.get_my_client_ids())
    OR public.is_super_admin()
  )
  WITH CHECK (
    client_id IN (SELECT public.get_my_client_ids())
    OR public.is_super_admin()
  );

CREATE POLICY "Users can delete agents from their client"
  ON public.agents FOR DELETE
  TO authenticated
  USING (
    client_id IN (SELECT public.get_my_client_ids())
    OR public.is_super_admin()
  );

-- ══════════════════════════════════════════════════════════
-- CHAT_HISTORY
-- ══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can view chats from their agents" ON public.chat_history;
DROP POLICY IF EXISTS "Users can insert chats for their agents" ON public.chat_history;
DROP POLICY IF EXISTS "Users can update chats from their agents" ON public.chat_history;

CREATE POLICY "Users can view chats from their agents"
  ON public.chat_history FOR SELECT
  TO authenticated
  USING (
    agent_id IN (
      SELECT agent_id FROM public.agents
      WHERE client_id IN (SELECT public.get_my_client_ids())
    )
    OR public.is_super_admin()
  );

CREATE POLICY "Users can insert chats for their agents"
  ON public.chat_history FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id IN (
      SELECT agent_id FROM public.agents
      WHERE client_id IN (SELECT public.get_my_client_ids())
    )
    OR public.is_super_admin()
  );

CREATE POLICY "Users can update chats from their agents"
  ON public.chat_history FOR UPDATE
  TO authenticated
  USING (
    agent_id IN (
      SELECT agent_id FROM public.agents
      WHERE client_id IN (SELECT public.get_my_client_ids())
    )
    OR public.is_super_admin()
  );

-- ══════════════════════════════════════════════════════════
-- TOKEN_BALANCES
-- ══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can view their client's token balance" ON public.token_balances;
DROP POLICY IF EXISTS "Users can update their client's token balance" ON public.token_balances;

CREATE POLICY "Users can view their client's token balance"
  ON public.token_balances FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT public.get_my_client_ids())
    OR public.is_super_admin()
  );

CREATE POLICY "Users can update their client's token balance"
  ON public.token_balances FOR UPDATE
  TO authenticated
  USING (
    client_id IN (SELECT public.get_my_client_ids())
    OR public.is_super_admin()
  );

-- ══════════════════════════════════════════════════════════
-- TOKEN_TRANSACTIONS
-- ══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can view their client's token transactions" ON public.token_transactions;
DROP POLICY IF EXISTS "Users can insert token transactions for their client" ON public.token_transactions;

CREATE POLICY "Users can view their client's token transactions"
  ON public.token_transactions FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT public.get_my_client_ids())
    OR public.is_super_admin()
  );

CREATE POLICY "Users can insert token transactions for their client"
  ON public.token_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (SELECT public.get_my_client_ids())
    OR public.is_super_admin()
  );

-- ══════════════════════════════════════════════════════════
-- TOKEN_PACKAGES
-- ══════════════════════════════════════════════════════════

-- Token packages son públicos (todos pueden verlos)
-- Ya tienen política correcta

-- ══════════════════════════════════════════════════════════
-- SERVICE_ORDERS
-- ══════════════════════════════════════════════════════════

-- Ya tienen políticas correctas (se crearon con super admin access)


-- ══════════════════════════════════════════════════════════
-- CLIENT_MEMBERS (para gestión de equipo)
-- ══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can view members from their client" ON public.client_members;
DROP POLICY IF EXISTS "Admins can insert members to their client" ON public.client_members;
DROP POLICY IF EXISTS "Admins can update members from their client" ON public.client_members;
DROP POLICY IF EXISTS "Admins can delete members from their client" ON public.client_members;

CREATE POLICY "Users can view members from their client"
  ON public.client_members FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT public.get_my_client_ids())
    OR public.is_super_admin()
  );

CREATE POLICY "Admins can insert members to their client"
  ON public.client_members FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      client_id IN (SELECT public.get_my_client_ids())
      AND EXISTS (
        SELECT 1 FROM public.client_members
        WHERE auth_user_id = auth.uid()
          AND client_id = client_members.client_id
          AND role IN ('admin', 'super_admin')
          AND status = 'active'
      )
    )
    OR public.is_super_admin()
  );

CREATE POLICY "Admins can update members from their client"
  ON public.client_members FOR UPDATE
  TO authenticated
  USING (
    (
      client_id IN (SELECT public.get_my_client_ids())
      AND EXISTS (
        SELECT 1 FROM public.client_members
        WHERE auth_user_id = auth.uid()
          AND client_id = client_members.client_id
          AND role IN ('admin', 'super_admin')
          AND status = 'active'
      )
    )
    OR public.is_super_admin()
  );

CREATE POLICY "Admins can delete members from their client"
  ON public.client_members FOR DELETE
  TO authenticated
  USING (
    (
      client_id IN (SELECT public.get_my_client_ids())
      AND EXISTS (
        SELECT 1 FROM public.client_members
        WHERE auth_user_id = auth.uid()
          AND client_id = client_members.client_id
          AND role IN ('admin', 'super_admin')
          AND status = 'active'
      )
    )
    OR public.is_super_admin()
  );


