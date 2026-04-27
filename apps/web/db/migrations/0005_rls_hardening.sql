CREATE SCHEMA IF NOT EXISTS app_private;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_private.rls_mode()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(nullif(current_setting('app.rls_mode', true), ''), 'anon')
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_private.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('app.user_id', true), '')
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_private.current_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(nullif(current_setting('app.role', true), ''), 'user')
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_private.is_service()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app_private.rls_mode() = 'service'
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app_private.is_service()
    OR app_private.current_role() IN ('admin', 'super_admin')
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_private.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app_private.is_service()
    OR app_private.current_role() = 'super_admin'
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_private.is_project_member(project_id_input text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM project_memberships pm
    WHERE pm.project_id = project_id_input
      AND pm.user_id = app_private.current_user_id()
  )
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_private.is_project_owner(project_id_input text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM projects p
    WHERE p.id = project_id_input
      AND p.owner_user_id = app_private.current_user_id()
  )
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_private.can_read_project(project_id_input text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT app_private.is_service()
    OR app_private.is_admin()
    OR EXISTS (
      SELECT 1
      FROM projects p
      WHERE p.id = project_id_input
        AND (
          p.status IN ('live', 'simulated_live')
          OR p.owner_user_id = app_private.current_user_id()
          OR app_private.is_project_member(p.id)
        )
    )
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_private.can_operate_project(project_id_input text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT app_private.is_service()
    OR app_private.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM projects p
      WHERE p.id = project_id_input
        AND p.owner_user_id = app_private.current_user_id()
    )
$$;--> statement-breakpoint

ALTER TABLE users ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE project_memberships ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE contributor_claims ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE payout_recipients ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE escrow_holdings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE gh_indexer_state ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE webhooks_inbox ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS users_read ON users;--> statement-breakpoint
CREATE POLICY users_read ON users
  FOR SELECT
  USING (
    app_private.is_admin()
    OR id = app_private.current_user_id()
  );--> statement-breakpoint

DROP POLICY IF EXISTS users_insert_service ON users;--> statement-breakpoint
CREATE POLICY users_insert_service ON users
  FOR INSERT
  WITH CHECK (app_private.is_service());--> statement-breakpoint

DROP POLICY IF EXISTS users_update_self_or_admin ON users;--> statement-breakpoint
CREATE POLICY users_update_self_or_admin ON users
  FOR UPDATE
  USING (app_private.is_super_admin() OR id = app_private.current_user_id())
  WITH CHECK (app_private.is_super_admin() OR id = app_private.current_user_id());--> statement-breakpoint

DROP POLICY IF EXISTS users_delete_service ON users;--> statement-breakpoint
CREATE POLICY users_delete_service ON users
  FOR DELETE
  USING (app_private.is_service());--> statement-breakpoint

DROP POLICY IF EXISTS sessions_service ON sessions;--> statement-breakpoint
CREATE POLICY sessions_service ON sessions
  FOR ALL
  USING (app_private.is_service() OR user_id = app_private.current_user_id())
  WITH CHECK (app_private.is_service() OR user_id = app_private.current_user_id());--> statement-breakpoint

DROP POLICY IF EXISTS accounts_service ON accounts;--> statement-breakpoint
CREATE POLICY accounts_service ON accounts
  FOR ALL
  USING (app_private.is_service() OR user_id = app_private.current_user_id())
  WITH CHECK (app_private.is_service() OR user_id = app_private.current_user_id());--> statement-breakpoint

DROP POLICY IF EXISTS verifications_service ON verifications;--> statement-breakpoint
CREATE POLICY verifications_service ON verifications
  FOR ALL
  USING (app_private.is_service())
  WITH CHECK (app_private.is_service());--> statement-breakpoint

DROP POLICY IF EXISTS wallets_owner_or_admin ON wallets;--> statement-breakpoint
CREATE POLICY wallets_owner_or_admin ON wallets
  FOR ALL
  USING (app_private.is_admin() OR user_id = app_private.current_user_id())
  WITH CHECK (app_private.is_admin() OR user_id = app_private.current_user_id());--> statement-breakpoint

DROP POLICY IF EXISTS projects_read ON projects;--> statement-breakpoint
CREATE POLICY projects_read ON projects
  FOR SELECT
  USING (
    app_private.is_admin()
    OR status IN ('live', 'simulated_live')
    OR owner_user_id = app_private.current_user_id()
    OR app_private.is_project_member(id)
  );--> statement-breakpoint

DROP POLICY IF EXISTS projects_insert ON projects;--> statement-breakpoint
CREATE POLICY projects_insert ON projects
  FOR INSERT
  WITH CHECK (
    app_private.is_service()
    OR app_private.is_super_admin()
    OR owner_user_id = app_private.current_user_id()
  );--> statement-breakpoint

DROP POLICY IF EXISTS projects_update ON projects;--> statement-breakpoint
CREATE POLICY projects_update ON projects
  FOR UPDATE
  USING (
    app_private.is_service()
    OR app_private.is_admin()
    OR owner_user_id = app_private.current_user_id()
  )
  WITH CHECK (
    app_private.is_service()
    OR app_private.is_admin()
    OR owner_user_id = app_private.current_user_id()
  );--> statement-breakpoint

DROP POLICY IF EXISTS projects_delete ON projects;--> statement-breakpoint
CREATE POLICY projects_delete ON projects
  FOR DELETE
  USING (
    app_private.is_service()
    OR app_private.is_super_admin()
    OR owner_user_id = app_private.current_user_id()
  );--> statement-breakpoint

DROP POLICY IF EXISTS memberships_read ON project_memberships;--> statement-breakpoint
CREATE POLICY memberships_read ON project_memberships
  FOR SELECT
  USING (
    app_private.is_admin()
    OR user_id = app_private.current_user_id()
    OR app_private.can_read_project(project_id)
  );--> statement-breakpoint

DROP POLICY IF EXISTS memberships_write ON project_memberships;--> statement-breakpoint
CREATE POLICY memberships_write ON project_memberships
  FOR ALL
  USING (
    app_private.is_service()
    OR app_private.is_super_admin()
    OR app_private.is_project_owner(project_id)
  )
  WITH CHECK (
    app_private.is_service()
    OR app_private.is_super_admin()
    OR app_private.is_project_owner(project_id)
  );--> statement-breakpoint

DROP POLICY IF EXISTS contributors_read ON contributors;--> statement-breakpoint
CREATE POLICY contributors_read ON contributors
  FOR SELECT
  USING (app_private.can_read_project(project_id));--> statement-breakpoint

DROP POLICY IF EXISTS contributors_write ON contributors;--> statement-breakpoint
CREATE POLICY contributors_write ON contributors
  FOR ALL
  USING (app_private.is_service() OR app_private.is_admin())
  WITH CHECK (app_private.is_service() OR app_private.is_admin());--> statement-breakpoint

DROP POLICY IF EXISTS claims_read ON contributor_claims;--> statement-breakpoint
CREATE POLICY claims_read ON contributor_claims
  FOR SELECT
  USING (
    app_private.is_service()
    OR app_private.is_admin()
    OR user_id = app_private.current_user_id()
    OR EXISTS (
      SELECT 1
      FROM contributors c
      WHERE c.id = contributor_claims.contributor_id
        AND app_private.can_read_project(c.project_id)
    )
  );--> statement-breakpoint

DROP POLICY IF EXISTS claims_write ON contributor_claims;--> statement-breakpoint
CREATE POLICY claims_write ON contributor_claims
  FOR ALL
  USING (app_private.is_service() OR user_id = app_private.current_user_id())
  WITH CHECK (app_private.is_service() OR user_id = app_private.current_user_id());--> statement-breakpoint

DROP POLICY IF EXISTS snapshots_read ON snapshots;--> statement-breakpoint
CREATE POLICY snapshots_read ON snapshots
  FOR SELECT
  USING (app_private.can_read_project(project_id));--> statement-breakpoint

DROP POLICY IF EXISTS snapshots_write ON snapshots;--> statement-breakpoint
CREATE POLICY snapshots_write ON snapshots
  FOR ALL
  USING (app_private.is_service() OR app_private.is_super_admin())
  WITH CHECK (app_private.is_service() OR app_private.is_super_admin());--> statement-breakpoint

DROP POLICY IF EXISTS payouts_read ON payouts;--> statement-breakpoint
CREATE POLICY payouts_read ON payouts
  FOR SELECT
  USING (app_private.can_read_project(project_id));--> statement-breakpoint

DROP POLICY IF EXISTS payouts_write ON payouts;--> statement-breakpoint
CREATE POLICY payouts_write ON payouts
  FOR ALL
  USING (app_private.is_service() OR app_private.is_admin())
  WITH CHECK (app_private.is_service() OR app_private.is_admin());--> statement-breakpoint

DROP POLICY IF EXISTS recipients_read ON payout_recipients;--> statement-breakpoint
CREATE POLICY recipients_read ON payout_recipients
  FOR SELECT
  USING (
    app_private.is_service()
    OR app_private.is_admin()
    OR EXISTS (
      SELECT 1
      FROM contributors c
      WHERE c.id = payout_recipients.contributor_id
        AND app_private.can_read_project(c.project_id)
    )
  );--> statement-breakpoint

DROP POLICY IF EXISTS recipients_write ON payout_recipients;--> statement-breakpoint
CREATE POLICY recipients_write ON payout_recipients
  FOR ALL
  USING (app_private.is_service() OR app_private.is_admin())
  WITH CHECK (app_private.is_service() OR app_private.is_admin());--> statement-breakpoint

DROP POLICY IF EXISTS escrow_read ON escrow_holdings;--> statement-breakpoint
CREATE POLICY escrow_read ON escrow_holdings
  FOR SELECT
  USING (
    app_private.is_service()
    OR app_private.is_admin()
    OR EXISTS (
      SELECT 1
      FROM contributors c
      LEFT JOIN contributor_claims cc ON cc.contributor_id = c.id
      WHERE c.id = escrow_holdings.contributor_id
        AND (
          cc.user_id = app_private.current_user_id()
          OR app_private.can_read_project(c.project_id)
        )
    )
  );--> statement-breakpoint

DROP POLICY IF EXISTS escrow_write ON escrow_holdings;--> statement-breakpoint
CREATE POLICY escrow_write ON escrow_holdings
  FOR ALL
  USING (app_private.is_service() OR app_private.is_admin())
  WITH CHECK (app_private.is_service() OR app_private.is_admin());--> statement-breakpoint

DROP POLICY IF EXISTS api_keys_read ON api_keys;--> statement-breakpoint
CREATE POLICY api_keys_read ON api_keys
  FOR SELECT
  USING (
    app_private.is_service()
    OR app_private.is_admin()
    OR app_private.can_operate_project(project_id)
  );--> statement-breakpoint

DROP POLICY IF EXISTS api_keys_write ON api_keys;--> statement-breakpoint
CREATE POLICY api_keys_write ON api_keys
  FOR ALL
  USING (app_private.is_service() OR app_private.can_operate_project(project_id))
  WITH CHECK (app_private.is_service() OR app_private.can_operate_project(project_id));--> statement-breakpoint

DROP POLICY IF EXISTS gh_state_service ON gh_indexer_state;--> statement-breakpoint
CREATE POLICY gh_state_service ON gh_indexer_state
  FOR ALL
  USING (app_private.is_service() OR app_private.is_admin())
  WITH CHECK (app_private.is_service());--> statement-breakpoint

DROP POLICY IF EXISTS platform_config_read ON platform_config;--> statement-breakpoint
CREATE POLICY platform_config_read ON platform_config
  FOR SELECT
  USING (
    app_private.is_service()
    OR app_private.is_admin()
    OR key LIKE 'project_docs.%'
    OR key LIKE 'banner.%'
    OR key LIKE 'feature_flags%'
  );--> statement-breakpoint

DROP POLICY IF EXISTS platform_config_write ON platform_config;--> statement-breakpoint
CREATE POLICY platform_config_write ON platform_config
  FOR ALL
  USING (app_private.is_service() OR app_private.is_super_admin())
  WITH CHECK (app_private.is_service() OR app_private.is_super_admin());--> statement-breakpoint

DROP POLICY IF EXISTS webhooks_service ON webhooks_inbox;--> statement-breakpoint
CREATE POLICY webhooks_service ON webhooks_inbox
  FOR ALL
  USING (app_private.is_service() OR app_private.is_admin())
  WITH CHECK (app_private.is_service());--> statement-breakpoint

DROP POLICY IF EXISTS audit_read ON audit_logs;--> statement-breakpoint
CREATE POLICY audit_read ON audit_logs
  FOR SELECT
  USING (
    app_private.is_service()
    OR app_private.is_admin()
    OR actor_user_id = app_private.current_user_id()
  );--> statement-breakpoint

DROP POLICY IF EXISTS audit_insert ON audit_logs;--> statement-breakpoint
CREATE POLICY audit_insert ON audit_logs
  FOR INSERT
  WITH CHECK (
    app_private.is_service()
    OR actor_user_id = app_private.current_user_id()
  );--> statement-breakpoint

DROP POLICY IF EXISTS audit_no_update ON audit_logs;--> statement-breakpoint
CREATE POLICY audit_no_update ON audit_logs
  FOR UPDATE
  USING (false)
  WITH CHECK (false);--> statement-breakpoint

DROP POLICY IF EXISTS audit_no_delete ON audit_logs;--> statement-breakpoint
CREATE POLICY audit_no_delete ON audit_logs
  FOR DELETE
  USING (false);
