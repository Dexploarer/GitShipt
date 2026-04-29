DO $$ BEGIN
  CREATE TYPE "public"."pending_admin_action_status" AS ENUM(
    'pending',
    'approved',
    'completed',
    'failed',
    'expired'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "pending_admin_actions" (
  "id" text PRIMARY KEY NOT NULL,
  "fingerprint" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "status" "pending_admin_action_status" DEFAULT 'pending' NOT NULL,
  "action" text NOT NULL,
  "permission" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "project_id" text,
  "actor_user_id" text NOT NULL,
  "approver_user_id" text,
  "reason" text NOT NULL,
  "target_name" text NOT NULL,
  "payload" jsonb NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "approved_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "failure_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "pending_admin_actions_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id")
    ON DELETE set null ON UPDATE no action,
  CONSTRAINT "pending_admin_actions_actor_user_id_users_id_fk"
    FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id")
    ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "pending_admin_actions_approver_user_id_users_id_fk"
    FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id")
    ON DELETE restrict ON UPDATE no action
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "pending_admin_actions_open_fingerprint_uq"
  ON "pending_admin_actions" USING btree ("fingerprint")
  WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_admin_actions_status_idx"
  ON "pending_admin_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_admin_actions_actor_idx"
  ON "pending_admin_actions" USING btree ("actor_user_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_admin_actions_target_idx"
  ON "pending_admin_actions" USING btree ("target_type", "target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_admin_actions_expires_idx"
  ON "pending_admin_actions" USING btree ("expires_at");--> statement-breakpoint

ALTER TABLE "pending_admin_actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS pending_admin_actions_super_admin ON pending_admin_actions;--> statement-breakpoint
CREATE POLICY pending_admin_actions_super_admin ON pending_admin_actions
  FOR ALL
  USING (app_private.is_service() OR app_private.is_super_admin())
  WITH CHECK (app_private.is_service() OR app_private.is_super_admin());--> statement-breakpoint
