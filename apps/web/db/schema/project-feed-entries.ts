import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createId } from "@repo/lib";
import { projects } from "./projects";

/**
 * Project feed — chronological summary cards synthesized from the logbook
 * (now-state) + git history (event stream). Powers
 * /r/[org]/[repo]/feed and /r/[org]/[repo]/feed.atom.
 *
 * Generation cadence:
 *   - `period_digest` : written by takeSnapshot at the end of a successful
 *                       per-project freeze. One row per (project, period).
 *   - milestone kinds : written by computeLeaderboard when detection fires.
 *                       Sparse, event-shaped. (Detection deferred to v2.)
 *
 * The `subjects` jsonb carries structured facts so the UI can render rich
 * cards (avatars, score breakdowns, link-throughs) without re-querying.
 * `body_md` is the deterministic templated narrative for ATOM/RSS readers
 * and any surface that wants prose without the React renderer.
 */

export const feedEntryKindEnum = pgEnum("feed_entry_kind", [
  /** Period-aligned snapshot summary. One per (project, snapshot_period). */
  "period_digest",
  /** First-time contributor crossed into ranked status. */
  "first_contributor",
  /** Score threshold (e.g., 100, 1000) crossed by a contributor. */
  "score_threshold",
  /** Project's first SOL payout completed. */
  "first_payout",
]);

/**
 * Structured payload shape for `period_digest` rows. Stored in `subjects`
 * jsonb. Keep this lean — the UI cards re-fetch fresh contributor avatars
 * server-side at render time; we don't snapshot every URL into the row.
 */
export interface PeriodDigestSubjects {
  snapshotId: string;
  /** Top N contributors at the period freeze (capped to 5 for cards). */
  topContributors: Array<{
    ghUsername: string;
    rank: number;
    score: number;
    weight: number;
    inputs: {
      mergedPRs: number;
      commits: number;
      reviews: number;
      issues: number;
      netLines: number;
    };
  }>;
  /** Aggregate counts across the entire frozen leaderboard. */
  totals: {
    contributors: number;
    mergedPRs: number;
    commits: number;
    reviews: number;
    issues: number;
    netLines: number;
  };
  /** YYYY-MM-DD period for the digest. Mirrors the snapshot row's period. */
  period: string;
}

export type FeedEntrySubjects = PeriodDigestSubjects | Record<string, unknown>;

export const projectFeedEntries = pgTable(
  "project_feed_entries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: feedEntryKindEnum("kind").notNull(),
    /** YYYY-MM-DD for period-aligned kinds; null for sparse milestones. */
    period: text("period"),
    subjects: jsonb("subjects").$type<FeedEntrySubjects>().notNull(),
    /** Pre-rendered markdown for ATOM/RSS + plain-text surfaces. */
    bodyMd: text("body_md").notNull(),
    /** Optional: pin a milestone card to top of the feed until this date. */
    pinnedUntil: timestamp("pinned_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    /** Primary read order — newest first per project. */
    projectCreatedIdx: index("project_feed_entries_project_created_idx").on(
      t.projectId,
      t.createdAt,
    ),
    /** Dedupe period_digest per (project, period). Partial: only the
     *  period-aligned kind has a non-null period; milestones don't. */
    projectPeriodKindUq: uniqueIndex(
      "project_feed_entries_project_period_kind_uq",
    )
      .on(t.projectId, t.kind, t.period)
      .where(sql`${t.period} IS NOT NULL`),
    /** Pinned-cards-first ordering on the feed page. */
    pinnedIdx: index("project_feed_entries_pinned_idx").on(t.pinnedUntil),
  }),
);
