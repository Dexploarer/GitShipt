import {
  pgEnum,
  pgTable,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createId } from "@repo/lib";
import { projects } from "./projects";

/**
 * Tracking table for the draft auto-review pipeline (shipshape design doc §6.5).
 * processDraftQueue workflow inserts a row when a draft PR is first auto-reviewed,
 * advances state on subsequent passes, and timestamps each transition for the
 * stale-elevation reminder/close cadence (7d ping → 14d stale-close).
 */

export const draftReviewStateEnum = pgEnum("draft_review_state", [
  "pending_review",
  "elevated_awaiting_maintainer",
  "elevated_reminded",
  "stale_closed",
  "no_penalty_closed",
  "merged_via_maintainer",
]);

export const pendingDraftReviews = pgTable(
  "pending_draft_reviews",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    prNumber: integer("pr_number").notNull(),
    /** Head SHA at the time of the most recent review pass. */
    prHeadSha: text("pr_head_sha").notNull(),
    state: draftReviewStateEnum("state").notNull().default("pending_review"),
    firstReviewedAt: timestamp("first_reviewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    elevatedAt: timestamp("elevated_at", { withTimezone: true }),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closeReason: text("close_reason"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    projectPrUq: uniqueIndex("pending_draft_reviews_project_pr_uq").on(
      t.projectId,
      t.prNumber,
    ),
    stateAgeIdx: index("pending_draft_reviews_state_age_idx").on(
      t.state,
      t.firstReviewedAt,
    ),
    closeMetadataConsistency: check(
      "pending_draft_reviews_close_metadata_consistency",
      sql`(
        ${t.state} IN ('stale_closed', 'no_penalty_closed', 'merged_via_maintainer')
        AND ${t.closedAt} IS NOT NULL
        AND ${t.closeReason} IS NOT NULL
        AND length(trim(${t.closeReason})) > 0
      ) OR (
        ${t.state} NOT IN ('stale_closed', 'no_penalty_closed', 'merged_via_maintainer')
        AND ${t.closedAt} IS NULL
        AND ${t.closeReason} IS NULL
      )`,
    ),
  }),
);
