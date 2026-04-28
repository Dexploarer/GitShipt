import {
  pgTable,
  text,
  bigint,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { contributors } from "./contributors";
import { createId } from "@repo/lib";

/**
 * Claimable SOL/SPL liabilities owed to a contributor whose wallet wasn't
 * linked at payout time. Drained on wallet link by `processClaim`.
 * `expiresAt` is an admin-review signal; it is not permission to silently
 * retire contributor rewards.
 */
export const escrowHoldings = pgTable(
  "escrow_holdings",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "restrict" }),
    tokenMint: text("token_mint"), // null for native SOL
    amountLamports: bigint("amount_lamports", { mode: "bigint" }).notNull(),
    sourcePayoutId: text("source_payout_id"),
    drainAttemptId: text("drain_attempt_id"),
    drainingAt: timestamp("draining_at", { withTimezone: true }),
    drainError: text("drain_error"),
    drainedAt: timestamp("drained_at", { withTimezone: true }),
    drainSignature: text("drain_signature"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    contributorIdx: index("escrow_contributor_idx").on(t.contributorId),
    expiresIdx: index("escrow_expires_idx").on(t.expiresAt),
    drainAttemptIdx: index("escrow_drain_attempt_idx").on(t.drainAttemptId),
  }),
);
