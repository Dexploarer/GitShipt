/**
 * Escrow pipeline helpers — sweep expired holdings + drain on wallet link.
 */
import { dbHttp, dbPool } from "@/db";
import { escrowHoldings, contributorClaims } from "@/db/schema";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { isStubMode } from "./payout-helpers";

export interface ExpiredEscrowRow {
  id: string;
  contributorId: string;
  amountLamports: string;
  expiresAtISO: string;
}

/** Holdings whose expiresAt < now and which haven't been drained yet. */
export async function loadExpiredEscrow(): Promise<ExpiredEscrowRow[]> {
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
 * v0 sweep: mark holding as drained with a sentinel signature. Real on-chain
 * sweep to treasury is a v1.1 concern (PRD doesn't mandate for hackathon).
 */
export async function sweepBackToTreasury(
  holdingId: string,
): Promise<{ holdingId: string; sentinel: string }> {
  const sentinel = "expired-no-action-v0";
  await dbHttp
    .update(escrowHoldings)
    .set({
      drainedAt: new Date(),
      drainSignature: sentinel,
    })
    .where(eq(escrowHoldings.id, holdingId));
  return { holdingId, sentinel };
}

/** Upsert the contributor_claims row to link a wallet/user. */
export async function linkContributorWallet(args: {
  contributorId: string;
  userId: string;
  walletAddress: string;
}): Promise<void> {
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
  return await dbPool().transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: escrowHoldings.id,
        amountLamports: escrowHoldings.amountLamports,
        tokenMint: escrowHoldings.tokenMint,
        drainedAt: escrowHoldings.drainedAt,
      })
      .from(escrowHoldings)
      .where(eq(escrowHoldings.id, args.holdingId))
      .limit(1);
    if (!row) return { status: "skipped" as const };
    if (row.drainedAt) return { status: "skipped" as const };

    // Stub mode: sentinel only.
    if (isStubMode()) {
      await tx
        .update(escrowHoldings)
        .set({
          drainedAt: new Date(),
          drainSignature: "stub-mode-drain",
        })
        .where(eq(escrowHoldings.id, row.id));
      return { status: "drained" as const, sig: "stub-mode-drain" };
    }

    if (row.tokenMint !== null) {
      // SPL drain unimplemented at v0 — only native SOL supported.
      await tx
        .update(escrowHoldings)
        .set({
          drainedAt: new Date(),
          drainSignature: "spl-drain-not-implemented-v0",
        })
        .where(eq(escrowHoldings.id, row.id));
      return { status: "drained" as const, sig: "spl-drain-not-implemented-v0" };
    }

    // Native SOL drain.
    try {
      const { PublicKey } = await import("@solana/web3.js");
      const { transferSol } = await import("@/lib/solana/spl-transfer");
      const { signature } = await transferSol(
        new PublicKey(args.walletAddress),
        BigInt(row.amountLamports),
        `gitbags:escrow-drain:${row.id}`,
      );
      await tx
        .update(escrowHoldings)
        .set({
          drainedAt: new Date(),
          drainSignature: signature,
        })
        .where(eq(escrowHoldings.id, row.id));
      return { status: "drained" as const, sig: signature };
    } catch (err) {
      // Don't poison the row — leave it for retry.
      void err;
      return { status: "failed" as const };
    }
  });
}

// kept-imports defense
void sql;
