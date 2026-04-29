-- Payout FSM enforcement.
--
-- The application layer is the primary boundary, but a corrupt write, a buggy
-- compensator, or a future migration could move a row from `completed` back to
-- `pending` without trace. This migration:
--
--   1. Creates an insert-only `payout_status_events` ledger so every status
--      change leaves a paper trail keyed on the row id, the old/new statuses,
--      and the actor (workflow step or service).
--   2. Adds a BEFORE UPDATE trigger on `payouts` that:
--        - Asserts the next status is reachable from the current one.
--        - Writes a ledger row when the status actually changes.
--      Same-status updates (e.g. setting `claimFinalizedAt` on a `completed`
--      payout) pass through untouched.
--
-- Allowed transitions (from -> to):
--
--   pending      -> claiming | cancelled | simulated | failed
--   claiming     -> distributing | failed | cancelled | completed
--   distributing -> completed | failed
--   failed       -> claiming | cancelled | simulated
--   completed    -> (terminal)
--   cancelled    -> (terminal)
--   simulated    -> (terminal)
--
-- "completed -> claiming" is intentionally NOT allowed: re-running a finished
-- payout requires creating a new `payouts` row tied to a fresh snapshot.

CREATE TABLE IF NOT EXISTS "payout_status_events" (
  "id" text PRIMARY KEY,
  "payout_id" text NOT NULL REFERENCES "payouts"("id") ON DELETE CASCADE,
  "from_status" "payout_status",
  "to_status" "payout_status" NOT NULL,
  "actor" text,
  "reason" text,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "payout_status_events_payout_idx"
  ON "payout_status_events" ("payout_id", "created_at");
--> statement-breakpoint

ALTER TABLE "payout_status_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DO $$ BEGIN
  CREATE POLICY "payout_status_events_service_only_insert"
    ON "payout_status_events"
    FOR INSERT TO PUBLIC
    WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE POLICY "payout_status_events_no_update"
    ON "payout_status_events"
    FOR UPDATE TO PUBLIC
    USING (false);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE POLICY "payout_status_events_no_delete"
    ON "payout_status_events"
    FOR DELETE TO PUBLIC
    USING (false);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "gitshipt_payout_status_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  v_allowed := CASE OLD.status
    WHEN 'pending' THEN
      NEW.status IN ('claiming', 'cancelled', 'simulated', 'failed')
    WHEN 'claiming' THEN
      NEW.status IN ('distributing', 'failed', 'cancelled', 'completed')
    WHEN 'distributing' THEN
      NEW.status IN ('completed', 'failed')
    WHEN 'failed' THEN
      NEW.status IN ('claiming', 'cancelled', 'simulated')
    ELSE
      false  -- completed / cancelled / simulated are terminal
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION
      'illegal payout status transition: % -> % (payout_id=%)',
      OLD.status, NEW.status, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO "payout_status_events" (
    "id", "payout_id", "from_status", "to_status", "actor", "metadata"
  ) VALUES (
    -- Use a 26-char text id matching createId() shape; gen_random_uuid()
    -- would also work but createId IDs are emitted by the app layer.
    encode(gen_random_bytes(13), 'hex'),
    NEW.id,
    OLD.status,
    NEW.status,
    current_setting('gitshipt.actor', true),
    NULL
  );

  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "payouts_status_guard" ON "payouts";
--> statement-breakpoint

CREATE TRIGGER "payouts_status_guard"
  BEFORE UPDATE OF "status" ON "payouts"
  FOR EACH ROW
  EXECUTE FUNCTION "gitshipt_payout_status_guard"();
--> statement-breakpoint

-- Backfill: write an initial event row for every existing payout so the
-- ledger is complete from this migration forward.
INSERT INTO "payout_status_events"
  ("id", "payout_id", "from_status", "to_status", "actor", "metadata", "created_at")
SELECT
  encode(gen_random_bytes(13), 'hex'),
  p."id",
  NULL,
  p."status",
  'migration:0012',
  jsonb_build_object('backfill', true),
  COALESCE(p."created_at", now())
FROM "payouts" p
ON CONFLICT DO NOTHING;
