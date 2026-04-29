/**
 * Claimable liability helpers — review expired holdings + drain on wallet link.
 */
import { dbHttp, dbPool } from "@/db";
import { escrowHoldings, contributorClaims } from "@/db/schema";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { isStubMode } from "./payout-helpers";
import { applyDbRlsContext, enterDbWorkflowContext } from "@/lib/db-rls";

const MANUAL_RECONCILIATION_ERROR =
  "manual_reconciliation_required_external_side_effect_may_have_succeeded";
const DRAIN_RECONCILIATION_AFTER_MS = 10 * 60 * 1000;

export interface ExpiredEscrowRow {
  id: string;
  contributorId: string;
  amountLamports: string;
  expiresAtISO: string;
}

/** Holdings whose expiresAt < now and which haven't been drained or reviewed. */
export async function loadExpiredEscrow(): Promise<ExpiredEscrowRow[]> {
  "use step";
  enterDbWorkflowContext("escrow-helpers:loadExpiredEscrow");
  const rows = await dbHttp
    .select({
      id: escrowHoldings.id,
      contributorId: escrowHoldings.contributorId,
      amountLamports: escrowHoldings.amountLamports,
      expiresAt: escrowHoldings.expiresAt,
    })
    .from(escrowHoldings)
    .where(
      and(
        lt(escrowHoldings.expiresAt, new Date()),
        isNull(escrowHoldings.drainedAt),
        isNull(escrowHoldings.drainAttemptId),
        isNull(escrowHoldings.drainError),
      ),
    );
  return rows.map((r) => ({
    id: r.id,
    contributorId: r.contributorId,
    amountLamports: r.amountLamports.toString(),
    expiresAtISO: r.expiresAt.toISOString(),
  }));
}

/**
 * Expiry is an accounting review signal, not a transfer. Unclaimed rewards
 * remain owed until the contributor links a wallet or an explicit admin/legal
 * reallocation policy settles them with an auditable transaction.
 */
export async function sweepBackToTreasury(
  holdingId: string,
): Promise<{
  holdingId: string;
  status: "drained" | "failed" | "skipped";
  sentinel?: string;
  reason?: string;
}> {
  "use step";
  enterDbWorkflowContext("escrow-helpers:sweepBackToTreasury");
  const [row] = await dbHttp
    .select({
      id: escrowHoldings.id,
      tokenMint: escrowHoldings.tokenMint,
      drainedAt: escrowHoldings.drainedAt,
    })
    .from(escrowHoldings)
    .where(eq(escrowHoldings.id, holdingId))
    .limit(1);

  if (!row || row.drainedAt) {
    return { holdingId, status: "skipped" };
  }

  if (row.tokenMint !== null) {
    const reason = "spl-escrow-sweep-not-implemented-v0";
    await dbHttp
      .update(escrowHoldings)
      .set({
        drainAttemptId: null,
        drainingAt: null,
        drainError: reason,
      })
      .where(eq(escrowHoldings.id, holdingId));
    return { holdingId, status: "failed", reason };
  }

  const reason = "expired-liability-held-for-admin-review";
  await dbHttp
    .update(escrowHoldings)
    .set({
      drainAttemptId: null,
      drainingAt: null,
      drainError: reason,
    })
    .where(eq(escrowHoldings.id, holdingId));
  return { holdingId, status: "skipped", reason };
}

/** Upsert the contributor_claims row to link a wallet/user. */
export async function linkContributorWallet(args: {
  contributorId: string;
  userId: string;
  walletAddress: string;
}): Promise<void> {
  "use step";
  enterDbWorkflowContext("escrow-helpers:linkContributorWallet");
  const now = new Date();
  await dbHttp
    .insert(contributorClaims)
    .values({
      contributorId: args.contributorId,
      userId: args.userId,
      walletAddress: args.walletAddress,
      claimedAt: now,
    })
    .onConflictDoUpdate({
      target: contributorClaims.contributorId,
      set: {
        userId: args.userId,
        walletAddress: args.walletAddress,
        claimedAt: now,
      },
    });
}

export interface ActiveEscrowRow {
  id: string;
  amountLamports: string;
  tokenMint: string | null;
}

export async function loadActiveEscrowFor(
  contributorId: string,
): Promise<ActiveEscrowRow[]> {
  "use step";
  enterDbWorkflowContext("escrow-helpers:loadActiveEscrowFor");
  const rows = await dbHttp
    .select({
      id: escrowHoldings.id,
      amountLamports: escrowHoldings.amountLamports,
      tokenMint: escrowHoldings.tokenMint,
    })
    .from(escrowHoldings)
    .where(
      and(
        eq(escrowHoldings.contributorId, contributorId),
        isNull(escrowHoldings.drainedAt),
      ),
    );
  return rows.map((r) => ({
    id: r.id,
    amountLamports: r.amountLamports.toString(),
    tokenMint: r.tokenMint,
  }));
}

/**
 * Drain a single escrow holding to the linked wallet.
 *  - Native SOL (tokenMint=null): on-chain transfer via spl-transfer wrapper.
 *  - Stub mode: mark drained with sentinel, no chain call.
 *
 * Idempotent: skips if already drained.
 */
export async function drainHoldingToWallet(args: {
  holdingId: string;
  walletAddress: string;
}): Promise<{ status: "drained" | "skipped" | "failed"; sig?: string }> {
  "use step";
  const claim = await dbPool().transaction(async (tx) => {
    await applyDbRlsContext(tx, {
      mode: "service",
      reason: "workflow:escrow-helpers:drainHoldingToWallet",
    });
    const [row] = await tx
      .select({
        id: escrowHoldings.id,
        amountLamports: escrowHoldings.amountLamports,
        tokenMint: escrowHoldings.tokenMint,
        drainedAt: escrowHoldings.drainedAt,
        drainAttemptId: escrowHoldings.drainAttemptId,
        drainingAt: escrowHoldings.drainingAt,
      })
      .from(escrowHoldings)
      .where(eq(escrowHoldings.id, args.holdingId))
      .limit(1);
    if (!row) return { status: "skipped" as const };
    if (row.drainedAt) return { status: "skipped" as const };
    if (row.drainAttemptId) {
      if (
        row.drainingAt &&
        Date.now() - row.drainingAt.getTime() >= DRAIN_RECONCILIATION_AFTER_MS
      ) {
        await tx
          .update(escrowHoldings)
          .set({
            drainError: `${MANUAL_RECONCILIATION_ERROR}:attempt=${row.drainAttemptId}`,
          })
          .where(
            and(
              eq(escrowHoldings.id, row.id),
              eq(escrowHoldings.drainAttemptId, row.drainAttemptId),
              isNull(escrowHoldings.drainedAt),
            ),
          );
      }
      return { status: "skipped" as const };
    }

    // Stub mode: sentinel only.
    if (isStubMode()) {
      await tx
        .update(escrowHoldings)
        .set({
          drainedAt: new Date(),
          drainSignature: "stub-mode-drain",
          drainAttemptId: null,
          drainingAt: null,
          drainError: null,
        })
        .where(eq(escrowHoldings.id, row.id));
      return { status: "drained" as const, sig: "stub-mode-drain" };
    }

    if (row.tokenMint !== null) {
      // SPL drain unimplemented at v0 — leave the holding claimable and make
      // the failure explicit instead of pretending an on-chain transfer ran.
      const reason = "spl-escrow-drain-not-implemented-v0";
      await tx
        .update(escrowHoldings)
        .set({
          drainAttemptId: null,
          drainingAt: null,
          drainError: reason,
        })
        .where(eq(escrowHoldings.id, row.id));
      return { status: "failed" as const };
    }

    const attemptId = `escrow:${row.id}`;
    const [claimed] = await tx
      .update(escrowHoldings)
      .set({
        drainAttemptId: attemptId,
        drainingAt: new Date(),
        drainError: null,
      })
      .where(
        and(
          eq(escrowHoldings.id, row.id),
          isNull(escrowHoldings.drainedAt),
          isNull(escrowHoldings.drainAttemptId),
        ),
      )
      .returning({
        id: escrowHoldings.id,
        amountLamports: escrowHoldings.amountLamports,
        attemptId: escrowHoldings.drainAttemptId,
      });
    if (!claimed?.attemptId) return { status: "skipped" as const };

    return {
      status: "claimed" as const,
      holdingId: claimed.id,
      amountLamports: claimed.amountLamports.toString(),
      attemptId: claimed.attemptId,
    };
  });

  if (claim.status !== "claimed") return claim;

  let signature: string;
  try {
    const { PublicKey } = await import("@solana/web3.js");
    const { transferSol } = await import("@/lib/solana/spl-transfer");
    const result = await transferSol(
      new PublicKey(args.walletAddress),
      BigInt(claim.amountLamports),
      `gitshipt:escrow-drain:${claim.holdingId}`,
    );
    signature = result.signature;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await dbHttp
      .update(escrowHoldings)
      .set({
        drainAttemptId: null,
        drainingAt: null,
        drainError: message.slice(0, 500),
      })
      .where(
        and(
          eq(escrowHoldings.id, claim.holdingId),
          eq(escrowHoldings.drainAttemptId, claim.attemptId),
          isNull(escrowHoldings.drainedAt),
        ),
      );
    return { status: "failed" as const };
  }

  await markHoldingDrainedWithRetry({
    holdingId: claim.holdingId,
    attemptId: claim.attemptId,
    signature,
  });
  return { status: "drained" as const, sig: signature };
}

async function markHoldingDrainedWithRetry(args: {
  holdingId: string;
  attemptId: string;
  signature: string;
}): Promise<void> {
  "use step";
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await dbHttp
        .update(escrowHoldings)
        .set({
          drainedAt: new Date(),
          drainSignature: args.signature,
          drainAttemptId: null,
          drainingAt: null,
          drainError: null,
        })
        .where(
          and(
            eq(escrowHoldings.id, args.holdingId),
            eq(escrowHoldings.drainAttemptId, args.attemptId),
            isNull(escrowHoldings.drainedAt),
          ),
        );
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : String(lastError);
  await dbHttp
    .update(escrowHoldings)
    .set({
      drainError: `${MANUAL_RECONCILIATION_ERROR}:signature=${args.signature};${message}`.slice(
        0,
        500,
      ),
    })
    .where(
      and(
        eq(escrowHoldings.id, args.holdingId),
        eq(escrowHoldings.drainAttemptId, args.attemptId),
        isNull(escrowHoldings.drainedAt),
      ),
    );
}

// kept-imports defense
void sql;
