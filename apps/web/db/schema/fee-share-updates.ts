import {
  pgEnum,
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { snapshots } from "./snapshots";
import { createId } from "@repo/lib";

export const feeShareUpdateStatusEnum = pgEnum("fee_share_update_status", [
  "pending",
  "sending",
  "succeeded",
  "failed",
  "skipped",
]);

export interface FeeShareUpdatePlanJson {
  feeClaimers: Array<{
    wallet: string;
    bps: number;
    role: "contributor" | "contributor_pool" | "treasury";
  }>;
  contributorPoolBps: number;
  directContributorBps: number;
  treasuryBps: number;
  pooledUnlinkedBps: number;
  pooledOverflowBps: number;
  pooledRoundingBps: number;
}

/**
 * Durable ledger for prospective Bags fee-share updates. A row is reserved
 * before any Bags transaction is signed, then finalized with signatures or
 * failure state after broadcast.
 */
export const feeShareUpdateAttempts = pgTable(
  "fee_share_update_attempts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    snapshotId: text("snapshot_id").references(() => snapshots.id, {
      onDelete: "set null",
    }),
    snapshotPeriod: text("snapshot_period").notNull(),
    targetHash: text("target_hash").notNull(),
    plan: jsonb("plan").$type<FeeShareUpdatePlanJson>().notNull(),
    status: feeShareUpdateStatusEnum("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    signatures: jsonb("signatures").$type<string[]>().notNull().default([]),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    projectIdx: index("fee_share_update_project_idx").on(t.projectId),
    snapshotIdx: index("fee_share_update_snapshot_idx").on(t.snapshotId),
    targetIdx: index("fee_share_update_target_idx").on(
      t.projectId,
      t.targetHash,
    ),
    statusIdx: index("fee_share_update_status_idx").on(t.status),
  }),
);
