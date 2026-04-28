DO $$ BEGIN
  CREATE TYPE "public"."partner_fee_claim_status" AS ENUM(
    'pending',
    'sending',
    'succeeded',
    'failed',
    'review'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."fund_reconciliation_status" AS ENUM(
    'clean',
    'warning',
    'critical'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "payouts"
  ADD COLUMN IF NOT EXISTS "claim_finalized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payout_recipients"
  ADD COLUMN IF NOT EXISTS "finalized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "escrow_holdings"
  ADD COLUMN IF NOT EXISTS "drain_finalized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "fee_share_update_attempts"
  ADD COLUMN IF NOT EXISTS "finalized_at" timestamp with time zone;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "partner_fee_claim_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "partner_wallet" text NOT NULL,
  "partner_config_key" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "status" "partner_fee_claim_status" DEFAULT 'pending' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "before_stats" jsonb DEFAULT null,
  "after_stats" jsonb DEFAULT null,
  "signatures" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "claimed_delta_lamports" bigint DEFAULT 0 NOT NULL,
  "unclaimed_delta_lamports" bigint DEFAULT 0 NOT NULL,
  "error" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "finalized_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "partner_fee_claim_attempts_idempotency_key_unique" UNIQUE("idempotency_key")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fund_reconciliation_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "status" "fund_reconciliation_status" DEFAULT 'clean' NOT NULL,
  "hot_wallet_address" text,
  "hot_wallet_balance_lamports" bigint DEFAULT 0 NOT NULL,
  "escrow_liability_lamports" bigint DEFAULT 0 NOT NULL,
  "unsettled_recipient_lamports" bigint DEFAULT 0 NOT NULL,
  "manual_review_count" integer DEFAULT 0 NOT NULL,
  "finalized_signature_count" integer DEFAULT 0 NOT NULL,
  "stale_signature_count" integer DEFAULT 0 NOT NULL,
  "issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "checked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "partner_fee_claim_idempotency_uq"
  ON "partner_fee_claim_attempts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_fee_claim_status_idx"
  ON "partner_fee_claim_attempts" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_fee_claim_wallet_idx"
  ON "partner_fee_claim_attempts" USING btree ("partner_wallet");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fund_reconciliation_checked_idx"
  ON "fund_reconciliation_runs" USING btree ("checked_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fund_reconciliation_status_idx"
  ON "fund_reconciliation_runs" USING btree ("status");--> statement-breakpoint

ALTER TABLE "partner_fee_claim_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fund_reconciliation_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS partner_fee_claim_attempts_admin ON partner_fee_claim_attempts;--> statement-breakpoint
CREATE POLICY partner_fee_claim_attempts_admin ON partner_fee_claim_attempts
  FOR ALL
  USING (app_private.is_service() OR app_private.is_admin())
  WITH CHECK (app_private.is_service() OR app_private.is_admin());--> statement-breakpoint

DROP POLICY IF EXISTS fund_reconciliation_runs_admin ON fund_reconciliation_runs;--> statement-breakpoint
CREATE POLICY fund_reconciliation_runs_admin ON fund_reconciliation_runs
  FOR ALL
  USING (app_private.is_service() OR app_private.is_admin())
  WITH CHECK (app_private.is_service() OR app_private.is_admin());--> statement-breakpoint
