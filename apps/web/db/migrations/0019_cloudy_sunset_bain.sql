-- Project feed v1 — schema migration
--
-- Adds project_feed_entries — chronological summary cards synthesized from
-- the per-snapshot logbook (now-state) plus indexed git history (event
-- stream). Powers /r/[org]/[repo]/feed and /r/[org]/[repo]/feed.atom.
--
-- Generation cadence:
--   period_digest : written by takeSnapshot at the end of a per-project
--                   freeze. One row per (project, period).
--   milestones    : reserved enum values for future v2 (first_contributor,
--                   score_threshold, first_payout); writers not wired in v1.

DO $$ BEGIN
  CREATE TYPE "public"."feed_entry_kind" AS ENUM(
    'period_digest',
    'first_contributor',
    'score_threshold',
    'first_payout'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "project_feed_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "kind" "feed_entry_kind" NOT NULL,
  "period" text,
  "subjects" jsonb NOT NULL,
  "body_md" text NOT NULL,
  "pinned_until" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "project_feed_entries_project_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id")
    ON DELETE CASCADE
);
--> statement-breakpoint

-- Primary read order — newest first per project.
CREATE INDEX IF NOT EXISTS "project_feed_entries_project_created_idx"
  ON "project_feed_entries" USING btree ("project_id", "created_at");
--> statement-breakpoint

-- Dedupe period-aligned digests per (project, kind, period). Partial index
-- so milestone rows (period IS NULL) don't conflict with each other.
CREATE UNIQUE INDEX IF NOT EXISTS "project_feed_entries_project_period_kind_uq"
  ON "project_feed_entries" USING btree ("project_id", "kind", "period")
  WHERE "period" IS NOT NULL;
--> statement-breakpoint

-- Pinned-cards-first ordering on the feed page.
CREATE INDEX IF NOT EXISTS "project_feed_entries_pinned_idx"
  ON "project_feed_entries" USING btree ("pinned_until");
