import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects";

/**
 * Per-project resume tokens for the GitHub indexer. `lastEventCursor`
 * lets us pull only deltas since the last successful sync; `lastFullSyncAt`
 * gates a full backfill if it gets too stale (>30d).
 */
export const ghIndexerState = pgTable("gh_indexer_state", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  lastEventCursor: text("last_event_cursor"),
  lastCommitSha: text("last_commit_sha"),
  lastFullSyncAt: timestamp("last_full_sync_at", { withTimezone: true }),
  lastIncrementalSyncAt: timestamp("last_incremental_sync_at", { withTimezone: true }),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
