import {
  pgEnum,
  pgTable,
  text,
  bigint,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projects } from "./projects";
import { snapshots } from "./snapshots";
import { contributors } from "./contributors";
import { createId } from "@/lib/ids";

export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "claiming",
  "distributing",
  "completed",
  "failed",
  "cancelled",
  // Stub-mode terminal status. Plan was computed and persisted, but no
  // on-chain claim or transfer ever happened. NEVER counts as a real
  // completed payout for ledger / accounting / discovery aggregations.
  "simulated",
]);

export const recipientStatusEnum = pgEnum("recipient_status", [
  "pending",
  "sent",
  "confirmed",
  "failed",
  "escrow",
]);

/**
 * One row per payout cycle per project. `claim_signature` is the Solana tx
 * for claiming Bags fees; per-recipient signatures live in
 * `payout_recipients`.
 */
export const payouts = pgTable(
  "payouts",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "restrict" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    totalAmountLamports: bigint("total_amount_lamports", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    claimSignature: text("claim_signature"),
    status: payoutStatusEnum("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    /** Set when payout finished in stub mode (no on-chain side effects). */
    simulatedAt: timestamp("simulated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    statusScheduledIdx: index("payouts_status_scheduled_idx").on(
      t.status,
      t.scheduledAt,
    ),
    snapshotUq: uniqueIndex("payouts_snapshot_uq").on(t.snapshotId),
    projectIdx: index("payouts_project_idx").on(t.projectId),
  }),
);

/**
 * Per-contributor row inside a payout. `idempotencyKey` is
 * `sha256(snapshotId|contributorId)` and prevents double-spend on retries.
 */
export const payoutRecipients = pgTable(
  "payout_recipients",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    payoutId: text("payout_id")
      .notNull()
      .references(() => payouts.id, { onDelete: "cascade" }),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "restrict" }),
    walletAddress: text("wallet_address"), // null when paid into escrow
    amountLamports: bigint("amount_lamports", { mode: "bigint" }).notNull(),
    rank: integer("rank").notNull(),
    weight: text("weight").notNull(), // stored as text decimal for precision
    status: recipientStatusEnum("status").notNull().default("pending"),
    txSignature: text("tx_signature"),
    idempotencyKey: text("idempotency_key").notNull(),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    idempotencyUq: uniqueIndex("recipients_idempotency_uq").on(t.idempotencyKey),
    payoutIdx: index("recipients_payout_idx").on(t.payoutId),
    contributorIdx: index("recipients_contributor_idx").on(t.contributorId),
    statusIdx: index("recipients_status_idx").on(t.status),
  }),
);
