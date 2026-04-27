import {
  pgEnum,
  pgTable,
  text,
  bigint,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projects } from "./projects";
import { createId } from "@repo/lib";

export const snapshotStatusEnum = pgEnum("snapshot_status", [
  "pending",
  "frozen",
  "paid",
  "failed",
]);

export interface LeaderboardEntry {
  contributorId: string;
  ghUsername: string;
  ghUserId: string;
  rank: number;
  score: number;
  weight: number; // tierWeights[rank-1]
  inputs: {
    mergedPRs: number;
    commits: number;
    reviews: number;
    issues: number;
    netLines: number;
  };
}

/**
 * Frozen leaderboard snapshot. Reproducible from `inputs` + `formulaVersion`
 * — re-running scoring on the same inputs must produce identical scores and
 * the same Merkle root.
 */
export const snapshots = pgTable(
  "snapshots",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    snapshotPeriod: text("snapshot_period").notNull(),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull(),
    formulaVersion: text("formula_version").notNull(),
    leaderboard: jsonb("leaderboard").$type<LeaderboardEntry[]>().notNull(),
    merkleRoot: text("merkle_root").notNull(),
    totalFeesLamports: bigint("total_fees_lamports", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    status: snapshotStatusEnum("status").notNull().default("pending"),
    forced: text("forced").notNull().default("false"),
    forcedBy: text("forced_by"), // user_id who triggered, if not cron
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    projectTakenIdx: index("snapshots_project_taken_idx").on(
      t.projectId,
      t.takenAt,
    ),
    periodIdx: index("snapshots_period_idx").on(t.snapshotPeriod),
    projectPeriodActiveUq: uniqueIndex("snapshots_project_period_active_uq")
      .on(t.projectId, t.snapshotPeriod)
      .where(sql`${t.status} in ('pending', 'frozen', 'paid')`),
    statusIdx: index("snapshots_status_idx").on(t.status),
  }),
);
