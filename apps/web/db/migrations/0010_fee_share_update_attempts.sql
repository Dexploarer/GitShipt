CREATE TYPE "public"."fee_share_update_status" AS ENUM(
  'pending',
  'sending',
  'succeeded',
  'failed',
  'skipped'
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fee_share_update_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "snapshot_id" text,
  "snapshot_period" text NOT NULL,
  "target_hash" text NOT NULL,
  "plan" jsonb NOT NULL,
  "status" "fee_share_update_status" DEFAULT 'pending' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "signatures" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "error" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "fee_share_update_attempts"
    ADD CONSTRAINT "fee_share_update_attempts_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "fee_share_update_attempts"
    ADD CONSTRAINT "fee_share_update_attempts_snapshot_id_snapshots_id_fk"
    FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "fee_share_update_project_idx"
  ON "fee_share_update_attempts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_share_update_snapshot_idx"
  ON "fee_share_update_attempts" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_share_update_target_idx"
  ON "fee_share_update_attempts" USING btree ("project_id", "target_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_share_update_status_idx"
  ON "fee_share_update_attempts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fee_share_update_active_target_uq"
  ON "fee_share_update_attempts" ("project_id", "target_hash")
  WHERE "status" IN ('pending', 'sending', 'succeeded');--> statement-breakpoint

ALTER TABLE "fee_share_update_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS fee_share_update_attempts_read ON fee_share_update_attempts;--> statement-breakpoint
CREATE POLICY fee_share_update_attempts_read ON fee_share_update_attempts
  FOR SELECT
  USING (app_private.can_read_project(project_id));--> statement-breakpoint

DROP POLICY IF EXISTS fee_share_update_attempts_write ON fee_share_update_attempts;--> statement-breakpoint
CREATE POLICY fee_share_update_attempts_write ON fee_share_update_attempts
  FOR ALL
  USING (app_private.is_service() OR app_private.is_admin())
  WITH CHECK (app_private.is_service() OR app_private.is_admin());--> statement-breakpoint
