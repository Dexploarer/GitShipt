-- Audit log hash chain (tamper-evident).
--
-- The audit_logs table is already append-only at the RLS layer (UPDATE / DELETE
-- denied). The hash chain adds tamper-EVIDENCE on top: each row carries a
-- sha256 of (prev_hash || canonical(row)), so retroactively editing or
-- deleting any row breaks the chain at every subsequent row, and the
-- verifyAuditChain helper detects the break on its next sweep.
--
--   row.entry_hash = sha256( row.prev_hash ||
--                            row.id || row.actor_user_id || row.action ||
--                            row.target_type || row.target_id ||
--                            canonical_json(row.metadata) ||
--                            row.ip || row.user_agent ||
--                            row.created_at )
--
-- The first row's prev_hash is the empty string, so the chain has a stable
-- genesis. The trigger acquires `pg_advisory_xact_lock(7421)` so parallel
-- INSERTs serialize on the chain head and prev_hash is never read stale.
-- Audit volume is low (admin actions, payouts, money-flow gates) so the
-- contention is negligible.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "prev_hash" text NOT NULL DEFAULT '';
--> statement-breakpoint

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "entry_hash" text NOT NULL DEFAULT '';
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "gitshipt_audit_canonical"(
  p_id text,
  p_actor_user_id text,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_metadata jsonb,
  p_ip text,
  p_user_agent text,
  p_created_at timestamptz,
  p_prev_hash text
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  -- jsonb concatenation produces canonical key-sorted output for hashing.
  -- COALESCE on each nullable field prevents NULL || ... = NULL.
  SELECT encode(
    digest(
      COALESCE(p_prev_hash, '') || '|' ||
      COALESCE(p_id, '') || '|' ||
      COALESCE(p_actor_user_id, '') || '|' ||
      COALESCE(p_action, '') || '|' ||
      COALESCE(p_target_type, '') || '|' ||
      COALESCE(p_target_id, '') || '|' ||
      COALESCE(p_metadata::text, 'null') || '|' ||
      COALESCE(p_ip, '') || '|' ||
      COALESCE(p_user_agent, '') || '|' ||
      COALESCE(p_created_at::text, ''),
      'sha256'
    ),
    'hex'
  );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "gitshipt_audit_chain_set_hashes"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_prev text;
BEGIN
  -- Serialize all chain-extending writes through a single advisory lock.
  PERFORM pg_advisory_xact_lock(7421);

  SELECT entry_hash INTO v_prev
  FROM audit_logs
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  NEW.prev_hash := COALESCE(v_prev, '');
  NEW.entry_hash := gitshipt_audit_canonical(
    NEW.id,
    NEW.actor_user_id,
    NEW.action,
    NEW.target_type,
    NEW.target_id,
    NEW.metadata,
    NEW.ip,
    NEW.user_agent,
    NEW.created_at,
    NEW.prev_hash
  );

  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "audit_logs_chain_set_hashes" ON "audit_logs";
--> statement-breakpoint

CREATE TRIGGER "audit_logs_chain_set_hashes"
  BEFORE INSERT ON "audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION "gitshipt_audit_chain_set_hashes"();
--> statement-breakpoint

-- Backfill existing rows in deterministic order. Each row's hash depends on
-- the previous row's hash, so we cannot just UPDATE in arbitrary order. We
-- iterate via a temporary plpgsql block. The genesis row gets prev_hash=''.
DO $$
DECLARE
  r RECORD;
  v_prev text := '';
  v_hash text;
BEGIN
  FOR r IN (
    SELECT id, actor_user_id, action, target_type, target_id, metadata,
           ip, user_agent, created_at
    FROM audit_logs
    ORDER BY created_at ASC, id ASC
  ) LOOP
    v_hash := gitshipt_audit_canonical(
      r.id, r.actor_user_id, r.action, r.target_type, r.target_id,
      r.metadata, r.ip, r.user_agent, r.created_at, v_prev
    );
    UPDATE audit_logs
       SET prev_hash = v_prev, entry_hash = v_hash
     WHERE id = r.id;
    v_prev := v_hash;
  END LOOP;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_logs_chain_idx"
  ON "audit_logs" ("created_at", "id");
