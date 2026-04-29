-- Shipshape spine v1 — schema migration
--
-- Lands the data spine for the contribution-economy upgrade described in
-- docs/shipshape-design.md (§5, §6.5–6.7, §8, §10, §12, §14.5):
--   - Per-contributor CI inputs, attribution model, community-verified flag
--   - Per-project alignment config, agent routing policy, community links,
--     install preferences, launch state machine, gh_org_id namespace FK
--   - New tables: organizations (default-config inheritance),
--     contributor_penalties (maintainer + CI flag system per §6.6),
--     pending_draft_reviews (auto-review pipeline state per §6.5)
--
-- v0 projects keep working: alignment_config, agent_routing_policy,
-- community_links default to NULL (mode short-circuits to "off"). The
-- score-inputs default object is filled with v1 zeros so old code paths
-- that omit the new fields still resolve cleanly.

-- New ENUMs ------------------------------------------------------------
-- Wrapped in DO blocks so a partial-failure rerun doesn't blow up on
-- duplicate_object. Matches the pattern in 0011_fund_reconciliation.sql.

DO $$ BEGIN
  CREATE TYPE "public"."contributor_attribution_type" AS ENUM (
    'human', 'agent_routed', 'bot_treasury', 'agent_unrouted'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."contributor_penalty_level" AS ENUM (
    'yellow', 'red', 'black'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."contributor_penalty_issued_by" AS ENUM (
    'human_maintainer', 'ci_workflow'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."project_launch_state" AS ENUM (
    'pending_install', 'awaiting_pr_merge', 'ready_to_launch', 'launched', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."draft_review_state" AS ENUM (
    'pending_review', 'elevated_awaiting_maintainer', 'elevated_reminded',
    'stale_closed', 'no_penalty_closed', 'merged_via_maintainer'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

-- organizations -------------------------------------------------------

CREATE TABLE IF NOT EXISTS "organizations" (
  "id" text PRIMARY KEY NOT NULL,
  "gh_org_id" text NOT NULL,
  "gh_login" text NOT NULL,
  "display_name" text,
  "default_scoring_config" jsonb,
  "default_alignment_config" jsonb,
  "default_agent_routing_policy" jsonb,
  "default_community_links" jsonb,
  "default_payout_config" jsonb,
  "primary_wallet_address" text,
  "installed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "installed_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_gh_org_id_uq"
  ON "organizations" USING btree ("gh_org_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_gh_login_uq"
  ON "organizations" USING btree ("gh_login");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_installed_by_idx"
  ON "organizations" USING btree ("installed_by_user_id");
--> statement-breakpoint

-- contributor_penalties ----------------------------------------------

CREATE TABLE IF NOT EXISTS "contributor_penalties" (
  "id" text PRIMARY KEY NOT NULL,
  "contributor_id" text NOT NULL,
  "project_id" text NOT NULL,
  "level" "contributor_penalty_level" NOT NULL,
  "reason" text NOT NULL,
  "evidence_pr_url" text,
  "evidence_url" text,
  "issued_by" "contributor_penalty_issued_by" NOT NULL,
  "issued_by_user_id" text,
  "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "cleared_at" timestamp with time zone,
  "cleared_by_user_id" text,
  CONSTRAINT "contributor_penalties_contributor_id_fk"
    FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id")
    ON DELETE CASCADE,
  CONSTRAINT "contributor_penalties_project_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id")
    ON DELETE CASCADE,
  -- CI-issued penalties must include an evidence URL (CI run); human-issued
  -- penalties may include one but it's not required.
  CONSTRAINT "contributor_penalties_ci_evidence_required"
    CHECK ("issued_by" <> 'ci_workflow' OR "evidence_url" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contributor_penalties_active_idx"
  ON "contributor_penalties" USING btree
  ("contributor_id", "project_id", "expires_at", "cleared_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contributor_penalties_project_level_idx"
  ON "contributor_penalties" USING btree ("project_id", "level", "expires_at");
--> statement-breakpoint

-- pending_draft_reviews ----------------------------------------------

CREATE TABLE IF NOT EXISTS "pending_draft_reviews" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "pr_number" integer NOT NULL,
  "pr_head_sha" text NOT NULL,
  "state" "draft_review_state" DEFAULT 'pending_review' NOT NULL,
  "first_reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "elevated_at" timestamp with time zone,
  "reminder_sent_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  "close_reason" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "pending_draft_reviews_project_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id")
    ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pending_draft_reviews_project_pr_uq"
  ON "pending_draft_reviews" USING btree ("project_id", "pr_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_draft_reviews_state_age_idx"
  ON "pending_draft_reviews" USING btree ("state", "first_reviewed_at");
--> statement-breakpoint

-- contributors extensions --------------------------------------------

-- v1 default object. Existing rows keep their current inputs; only fresh
-- inserts that omit `inputs` get the v1 zeros.
ALTER TABLE "contributors"
  ALTER COLUMN "inputs" SET DEFAULT
    '{"mergedPRs":0,"commits":0,"reviews":0,"issues":0,"netLines":0,"merges":0,"reviewSubstantiveScore":0,"coAuthored":0,"ci":{"prsTotal":0,"prsGreenOnFirstPush":0,"coverageDeltaBp":0,"bundleDeltaBytes":0,"perfDeltaBp":0,"vulnsIntroduced":0,"vulnsEliminated":0,"brokeMain":0}}'::jsonb;
--> statement-breakpoint
ALTER TABLE "contributors"
  ADD COLUMN IF NOT EXISTS "attribution_type" "contributor_attribution_type"
    DEFAULT 'human' NOT NULL;
--> statement-breakpoint
ALTER TABLE "contributors"
  ADD COLUMN IF NOT EXISTS "routes_to_contributor_id" text;
--> statement-breakpoint
ALTER TABLE "contributors"
  ADD COLUMN IF NOT EXISTS "community_verified" boolean
    DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "contributors"
  ADD COLUMN IF NOT EXISTS "community_verified_by" text;
--> statement-breakpoint
ALTER TABLE "contributors"
  ADD COLUMN IF NOT EXISTS "community_verified_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contributors_attribution_idx"
  ON "contributors" USING btree ("project_id", "attribution_type");
--> statement-breakpoint
-- For org-level cross-repo contributor aggregation (§14.5).
CREATE INDEX IF NOT EXISTS "contributors_gh_user_id_idx"
  ON "contributors" USING btree ("gh_user_id");
--> statement-breakpoint

-- projects extensions ------------------------------------------------

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "gh_org_id" text;
--> statement-breakpoint
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "alignment_config" jsonb;
--> statement-breakpoint
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "agent_routing_policy" jsonb;
--> statement-breakpoint
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "community_links" jsonb;
--> statement-breakpoint
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "install_preferences" jsonb;
--> statement-breakpoint
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "launch_state" "project_launch_state"
    DEFAULT 'pending_install' NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "install_runbook_pr_url" text;
--> statement-breakpoint
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "install_runbook_pr_number" integer;
--> statement-breakpoint
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "installer_gh_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_gh_org_id_idx"
  ON "projects" USING btree ("gh_org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_launch_state_idx"
  ON "projects" USING btree ("launch_state");
--> statement-breakpoint

-- Backfill: existing live projects predate the launch_state machine, so
-- mark them 'launched' to avoid them being gated by §12 launch-gate logic
-- when PR 2 ships. The 14-day shipshape migration window (§11) handles the
-- runbook side separately.
--
-- The `AND launch_state != 'launched'` clause is a no-op when the migration
-- runs cleanly (the column was just added with default 'pending_install'),
-- but it scopes a re-run / partially-applied retry to only the rows that
-- still need promotion — cheaper, idempotent, and self-documenting.
UPDATE "projects"
   SET "launch_state" = 'launched'
 WHERE "status" IN ('live', 'paused', 'killed', 'simulated_live')
   AND "launch_state" <> 'launched';
