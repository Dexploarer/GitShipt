/**
 * Payout pipeline helpers — DB I/O + Bags + Solana wrappers used by
 * workflows/executePayout.ts. Every function returns JSON-serializable
 * data; lamports are encoded as decimal strings.
 */
import { FatalError, getStepMetadata } from "workflow";
import { dbHttp, dbPool, schema } from "@/db";
import {
  payouts,
  payoutRecipients,
  snapshots,
  projects,
  escrowHoldings,
  platformConfig,
} from "@/db/schema";
import type { LeaderboardEntry } from "@/db/schema/snapshots";
import type { PayoutConfig, ScoringConfig } from "@/db/schema/projects";
import { and, eq, inArray, sql } from "drizzle-orm";
import { bags } from "@/lib/bags/client";
import {
  hasCredentials,
  canLaunchOnBags,
  stubsAllowed,
  serverEnv,
} from "@/lib/env";
import { computeMerkleRoot, sha256Hex } from "@/lib/payouts/merkle";
import { computeDistributionPlan } from "@/lib/payouts/distribution";
import { loadContributorWallets } from "./snapshot-helpers";
import {
  isKillSwitchEnabled,
  preflightSafety,
  getCycleCap,
  type SnapshotContextLike,
} from "@/lib/payouts/safety";
import { applyDbRlsContext, enterDbWorkflowContext } from "@/lib/db-rls";
import { payoutSignerPublicKey } from "@/lib/solana/signer";
import { withIdempotency } from "@/lib/idempotency";
import type { WorkflowLock } from "@/lib/workflow-locks";

export type { WorkflowLock };

void schema; // keep referenced for future use

const MANUAL_RECONCILIATION_ERROR =
  "manual_reconciliation_required_external_side_effect_may_have_succeeded";
const SENDING_RECONCILIATION_AFTER_MS = 10 * 60 * 1000;
const CLAIM_SIGNATURES_PATTERN = /(?:^|[:;])claim_signatures=([^;]+)/;

export function isManualReconciliationError(message: string): boolean {
  return message.includes(MANUAL_RECONCILIATION_ERROR);
}

export function extractManualReconciliationClaimSignatures(
  message: string,
): string | null {
  const raw = CLAIM_SIGNATURES_PATTERN.exec(message)?.[1]?.trim();
  if (!raw || raw === "unknown") return null;
  return raw;
}

function manualClaimReconciliationError(
  message: string,
  claimSignatures: readonly string[],
): Error {
  return new Error(
    `${MANUAL_RECONCILIATION_ERROR}:claim_signatures=${
      claimSignatures.length > 0 ? claimSignatures.join(",") : "unknown"
    };${message}`,
  );
}

/**
 * JSON-safe row used at workflow step boundaries — bigints encoded as
 * decimal strings, never raw bigint or Date.
 */
export interface DistributionPlanRowJson {
  contributorId: string;
  rank: number;
  weight: number;
  amountLamports: string;
  walletAddress: string | null;
  idempotencyKey: string;
}

export interface SnapshotContextJson {
  snapshot: {
    id: string;
    projectId: string;
    snapshotPeriod: string;
    formulaVersion: string;
    leaderboard: LeaderboardEntry[];
    merkleRoot: string;
    status: string;
    totalFeesLamports: string;
    takenAtISO: string;
  };
  project: {
    id: string;
    status: string;
    tokenMint: string | null;
    payoutConfig: PayoutConfig;
    scoringConfig: ScoringConfig;
  };
}

/** Build the deterministic idempotency key used on payout_recipients. */
export async function recipientIdempotencyKey(
  projectId: string,
  snapshotPeriod: string,
  contributorId: string,
): Promise<string> {
  return sha256Hex(`${projectId}|${snapshotPeriod}|${contributorId}`);
}

/** True when we should skip on-chain transactions and just record the plan. */
export function isStubMode(): boolean {
  const missing =
    !hasCredentials.bags() ||
    !hasCredentials.payoutKey() ||
    !hasCredentials.solana();
  if (missing && !stubsAllowed()) {
    throw new Error(
      "Live Bags, Solana RPC, and payout key credentials are required in production payouts.",
    );
  }
  if (missing) return true;
  const launch = canLaunchOnBags();
  if (!launch.ok && !stubsAllowed()) {
    throw new Error(`Live payout refused in production: ${launch.reason}`);
  }
  return !launch.ok;
}

/** Frozen snapshots that have no payout row, plus already-reserved rows that are safe to resume. */
export async function loadFrozenSnapshotsAwaitingPayout(): Promise<
  Array<{ id: string }>
> {
  enterDbWorkflowContext("payout-helpers:loadFrozenSnapshotsAwaitingPayout");
  const rows = await dbHttp.execute<{ id: string }>(sql`
    select distinct on (s.project_id, s.snapshot_period) s.id::text as id
    from snapshots s
    left join payouts p
      on p.project_id = s.project_id
     and p.snapshot_period = s.snapshot_period
    where s.status = 'frozen'
      and (
        p.id is null
        or (
          p.snapshot_id = s.id
          and p.status in ('pending', 'claiming')
          and p.claim_signature is null
          and (
            p.last_error is null
            or p.last_error not like ${`%${MANUAL_RECONCILIATION_ERROR}%`}
          )
        )
      )
    order by s.project_id, s.snapshot_period, s.taken_at asc, s.id asc
  `);
  return rows.rows.map((r) => ({ id: r.id }));
}

export async function loadSnapshotContext(
  snapshotId: string,
): Promise<SnapshotContextJson | null> {
  enterDbWorkflowContext("payout-helpers:loadSnapshotContext");
  const [row] = await dbHttp
    .select({
      snapshotId: snapshots.id,
      snapshotProjectId: snapshots.projectId,
      snapshotPeriod: snapshots.snapshotPeriod,
      formulaVersion: snapshots.formulaVersion,
      leaderboard: snapshots.leaderboard,
      merkleRoot: snapshots.merkleRoot,
      snapshotStatus: snapshots.status,
      totalFeesLamports: snapshots.totalFeesLamports,
      takenAt: snapshots.takenAt,
      projectId: projects.id,
      projectStatus: projects.status,
      tokenMint: projects.tokenMint,
      payoutConfig: projects.payoutConfig,
      scoringConfig: projects.scoringConfig,
    })
    .from(snapshots)
    .innerJoin(projects, eq(projects.id, snapshots.projectId))
    .where(eq(snapshots.id, snapshotId))
    .limit(1);

  if (!row) return null;

  const [periodPayout] = await dbHttp
    .select({ id: payouts.id, snapshotId: payouts.snapshotId })
    .from(payouts)
    .where(
      and(
        eq(payouts.projectId, row.projectId),
        eq(payouts.snapshotPeriod, row.snapshotPeriod),
      ),
    )
    .limit(1);
  if (periodPayout && periodPayout.snapshotId !== row.snapshotId) {
    return null;
  }

  return {
    snapshot: {
      id: row.snapshotId,
      projectId: row.snapshotProjectId,
      snapshotPeriod: row.snapshotPeriod,
      formulaVersion: row.formulaVersion,
      leaderboard: row.leaderboard,
      merkleRoot: row.merkleRoot,
      status: row.snapshotStatus,
      totalFeesLamports: row.totalFeesLamports.toString(),
      takenAtISO: row.takenAt.toISOString(),
    },
    project: {
      id: row.projectId,
      status: row.projectStatus,
      tokenMint: row.tokenMint,
      payoutConfig: row.payoutConfig,
      scoringConfig: row.scoringConfig,
    },
  };
}

export type PreflightJson =
  | { ok: true; balanceLamports: string }
  | { ok: false; reason: string };

export async function runPreflight(
  ctxJson: SnapshotContextJson,
): Promise<PreflightJson> {
  enterDbWorkflowContext("payout-helpers:runPreflight");
  const ctx: SnapshotContextLike = {
    snapshot: {
      id: ctxJson.snapshot.id,
      status: ctxJson.snapshot.status,
      totalFeesLamports: BigInt(ctxJson.snapshot.totalFeesLamports),
    },
    project: {
      id: ctxJson.project.id,
      status: ctxJson.project.status,
      tokenMint: ctxJson.project.tokenMint,
    },
  };
  const result = await preflightSafety(ctx);
  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, balanceLamports: result.balance.toString() };
}

export async function killSwitchAborted(): Promise<boolean> {
  enterDbWorkflowContext("payout-helpers:killSwitchAborted");
  return isKillSwitchEnabled();
}

/**
 * Total claimable lamports for the project's tokenMint at the platform-pool
 * wallet (= payoutSigner public key). Returns "0" in stub mode.
 *
 * This is the single source of truth for the cycle's payout amount.
 */
export async function checkClaimableLamports(args: {
  walletAddress: string | null;
  tokenMint: string | null;
}): Promise<{ lamports: string; positionCount: number }> {
  if (isStubMode()) {
    // STUB-MODE SYNTHESIS — no on-chain claim is performed. We return a
    // deterministic fake amount (1 SOL) so the planning pipeline can run
    // end-to-end for the demo. Downstream `finalizePayout` writes the row
    // with status='simulated' (NOT 'completed') and `simulated_at = now()`
    // so this fake amount never appears in real ledger / discovery sums.
    return { lamports: "1000000000", positionCount: 1 };
  }
  if (!args.walletAddress || !args.tokenMint) {
    return { lamports: "0", positionCount: 0 };
  }
  const positions = await bags.getClaimablePositions(args.walletAddress);
  let total = 0n;
  let count = 0;
  for (const p of positions.positions) {
    if (p.baseMint === args.tokenMint) {
      total += BigInt(p.totalClaimableLamportsUserShare ?? 0n);
      count++;
    }
  }
  return { lamports: total.toString(), positionCount: count };
}

/**
 * Claim Bags fees on chain. Signs each unsigned VersionedTransaction with the
 * payout signer and broadcasts. Returns the signature of the first tx (or a
 * comma-joined string when multiple). NEVER call this from stub mode — caller
 * must guard with `isStubMode()`.
 */
export async function claimBagsFees(args: {
  walletAddress: string;
  tokenMint: string;
  /**
   * When set, the most recent claim simulation digest is persisted to
   * `payouts.last_claim_simulation` for postmortem visibility. Failures of
   * this side-write are best-effort: simulation has already passed, so the
   * broadcast proceeds; persistence errors surface on the observability sink.
   */
  payoutId?: string;
}): Promise<{ signature: string | null; txCount: number }> {
  const { bags } = await import("@/lib/bags/client");
  const { transactions } = (await bags.getClaimTransactions(
    args.walletAddress,
    args.tokenMint,
  )) as { transactions: unknown[]; __stub?: boolean };

  if (!transactions || transactions.length === 0) {
    return { signature: null, txCount: 0 };
  }

  const { Transaction, VersionedTransaction } = await import("@solana/web3.js");
  const { solanaConnection } = await import("@/lib/solana/connection");
  const conn = solanaConnection("confirmed");

  const claimTransactions: Array<
    InstanceType<typeof VersionedTransaction> | InstanceType<typeof Transaction>
  > = [];
  for (const txUnknown of transactions) {
    if (
      txUnknown instanceof VersionedTransaction ||
      txUnknown instanceof Transaction
    ) {
      claimTransactions.push(txUnknown);
      continue;
    }

    throw new Error("Bags returned an unsupported claim transaction type.");
  }

  const persistDigest = args.payoutId
    ? async (digest: unknown) => {
        await dbHttp
          .update(payouts)
          .set({ lastClaimSimulation: digest })
          .where(eq(payouts.id, args.payoutId!));
      }
    : undefined;

  const sigs: string[] = [];
  for (const tx of claimTransactions) {
    try {
      const sig = await bags.signAndSubmitTransaction(tx, {
        operation: "Bags fee claim transaction",
        bagsInstructionPolicy: "fee-claim",
        onSimulation: persistDigest,
      });
      sigs.push(sig);
      await conn.confirmTransaction(sig, "confirmed");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw manualClaimReconciliationError(message, sigs);
    }
  }
  return {
    signature: sigs.length > 0 ? sigs.join(",") : null,
    txCount: sigs.length,
  };
}

/**
 * Build the per-recipient distribution plan from a context + claimed amount.
 * Resolves wallet addresses for each contributor.
 */
export async function buildPlan(
  ctxJson: SnapshotContextJson,
  claimedLamportsStr: string,
): Promise<DistributionPlanRowJson[]> {
  enterDbWorkflowContext("payout-helpers:buildPlan");
  const claimedLamports = BigInt(claimedLamportsStr);
  const contributorIds = ctxJson.snapshot.leaderboard.map(
    (e) => e.contributorId,
  );
  const wallets = await loadContributorWallets(contributorIds);
  const treasuryWallet = serverEnv().SOLANA_TREASURY_ADDRESS ?? null;
  const walletRoutes = { ...wallets };
  for (const entry of ctxJson.snapshot.leaderboard) {
    if (entry.payoutRoute !== "treasury") continue;
    if (!treasuryWallet) {
      throw new Error(
        `treasury_wallet_missing_for_automated_contributor:${entry.ghUsername}`,
      );
    }
    walletRoutes[entry.contributorId] = treasuryWallet;
  }
  const plan = computeDistributionPlan(
    ctxJson.snapshot.leaderboard,
    claimedLamports,
    ctxJson.project.payoutConfig,
    walletRoutes,
  );

  return Promise.all(
    plan.map(async (row) => ({
      contributorId: row.contributorId,
      rank: row.rank,
      weight: row.weight,
      amountLamports: row.amountLamports.toString(),
      walletAddress: row.walletAddress,
      idempotencyKey: await recipientIdempotencyKey(
        ctxJson.project.id,
        ctxJson.snapshot.snapshotPeriod,
        row.contributorId,
      ),
    })),
  );
}

/** Sanity cap check on the cycle total. */
export async function assertCycleUnderCap(
  planRowsJson: DistributionPlanRowJson[],
): Promise<{ ok: true; total: string } | { ok: false; reason: string }> {
  enterDbWorkflowContext("payout-helpers:assertCycleUnderCap");
  const total = planRowsJson.reduce(
    (acc, r) => acc + BigInt(r.amountLamports),
    0n,
  );
  const cap = await getCycleCap();
  if (total > cap) {
    return {
      ok: false,
      reason: `cycle_over_cap:total=${total.toString()},cap=${cap.toString()}`,
    };
  }
  return { ok: true, total: total.toString() };
}

/**
 * Persist the payout + payout_recipients in a single transaction.
 * Honors the recipients.idempotencyKey UNIQUE constraint via
 * `onConflictDoNothing` — re-running this step on the same snapshot is safe.
 *
 * If `stub === true`, every recipient row is created with status='pending'
 * and error='stub-mode' so the demo UI can show the would-have-been amounts.
 */
export async function persistPayoutPlan(args: {
  snapshotId: string;
  projectId: string;
  snapshotPeriod: string;
  plan: DistributionPlanRowJson[];
  claimSignature: string | null;
  totalLamportsStr: string;
  stub: boolean;
  reserveClaimFirst?: boolean;
  merkleRootOverride?: string;
}): Promise<{ payoutId: string; recipientCount: number }> {
  enterDbWorkflowContext("payout-helpers:persistPayoutPlan");
  const db = dbPool();
  const now = new Date();
  const totalLamports = BigInt(args.totalLamportsStr);

  // Compute the amount-tree merkle root (vs. the weight-tree at freeze time).
  const merkleRoot =
    args.merkleRootOverride ??
    (await computeMerkleRoot(
      args.plan.map((p) => ({
        contributorId: p.contributorId,
        amountLamports: BigInt(p.amountLamports),
      })),
    ));

  return await db.transaction(async (tx) => {
    await applyDbRlsContext(tx, {
      mode: "service",
      reason: "workflow:payout-helpers:persistPayoutPlan",
    });
    // Insert payout, returning the id. UNIQUE(project_id, snapshot_period) is
    // the period-level guard; UNIQUE(snapshot_id) remains a narrower retry
    // guard for the exact same snapshot.
    const [inserted] = await tx
      .insert(payouts)
      .values({
        snapshotId: args.snapshotId,
        projectId: args.projectId,
        snapshotPeriod: args.snapshotPeriod,
        totalAmountLamports: totalLamports,
        claimSignature: args.claimSignature,
        status: args.stub
          ? "pending"
          : args.reserveClaimFirst
            ? "claiming"
            : "distributing",
        attemptCount: 1,
        scheduledAt: now,
        startedAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: payouts.id, snapshotId: payouts.snapshotId });

    let payoutId: string;
    let payoutSnapshotId: string;
    if (inserted) {
      payoutId = inserted.id;
      payoutSnapshotId = inserted.snapshotId;
    } else {
      const [existing] = await tx
        .select({
          id: payouts.id,
          snapshotId: payouts.snapshotId,
          status: payouts.status,
          claimSignature: payouts.claimSignature,
          lastError: payouts.lastError,
        })
        .from(payouts)
        .where(
          and(
            eq(payouts.projectId, args.projectId),
            eq(payouts.snapshotPeriod, args.snapshotPeriod),
          ),
        )
        .limit(1);
      if (!existing) throw new Error("persistPayoutPlan: payout row missing");
      payoutId = existing.id;
      payoutSnapshotId = existing.snapshotId;

      if (payoutSnapshotId !== args.snapshotId) {
        const [existingRecipients] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(payoutRecipients)
          .where(eq(payoutRecipients.payoutId, payoutId));
        return { payoutId, recipientCount: existingRecipients?.count ?? 0 };
      }

      const retryableClaimReserve =
        !args.stub &&
        args.reserveClaimFirst === true &&
        existing.claimSignature === null &&
        !isManualReconciliationError(existing.lastError ?? "") &&
        (existing.status === "pending" || existing.status === "failed");

      if (retryableClaimReserve) {
        await tx
          .update(payouts)
          .set({
            status: "claiming",
            attemptCount: sql`${payouts.attemptCount} + 1`,
            lastError: null,
            startedAt: now,
          })
          .where(eq(payouts.id, payoutId));
      }
    }

    // Update snapshot with claim total + amount-tree merkle root.
    if (payoutSnapshotId === args.snapshotId) {
      await tx
        .update(snapshots)
        .set({
          totalFeesLamports: totalLamports,
          merkleRoot,
        })
        .where(eq(snapshots.id, args.snapshotId));
    }

    // Insert recipients; UNIQUE(idempotencyKey) absorbs retries.
    if (args.plan.length > 0) {
      await tx
        .insert(payoutRecipients)
        .values(
          args.plan.map((row) => ({
            payoutId,
            contributorId: row.contributorId,
            walletAddress: row.walletAddress,
            amountLamports: BigInt(row.amountLamports),
            rank: row.rank,
            weight: row.weight.toString(),
            status: "pending" as const,
            idempotencyKey: row.idempotencyKey,
            error: args.stub ? "stub-mode" : null,
          })),
        )
        .onConflictDoNothing({ target: payoutRecipients.idempotencyKey });
    }

    const [recipientCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(payoutRecipients)
      .where(eq(payoutRecipients.payoutId, payoutId));
    return {
      payoutId,
      recipientCount: recipientCount?.count ?? args.plan.length,
    };
  });
}

export async function markPayoutClaimed(
  payoutId: string,
  claimSignature: string | null,
): Promise<void> {
  enterDbWorkflowContext("payout-helpers:markPayoutClaimed");
  await dbHttp
    .update(payouts)
    .set({
      claimSignature,
      status: "distributing",
      lastError: null,
    })
    .where(
      and(
        eq(payouts.id, payoutId),
        inArray(payouts.status, ["pending", "claiming"]),
      ),
    );
}

export async function markPayoutFailed(
  payoutId: string,
  reason: string,
  options: { claimSignature?: string | null } = {},
): Promise<void> {
  enterDbWorkflowContext("payout-helpers:markPayoutFailed");
  const claimSignature =
    options.claimSignature ??
    extractManualReconciliationClaimSignatures(reason);
  await dbHttp
    .update(payouts)
    .set({
      status: "failed",
      ...(claimSignature ? { claimSignature } : {}),
      lastError: reason.slice(0, 1_000),
      executedAt: new Date(),
    })
    .where(eq(payouts.id, payoutId));
}

async function payoutCanDispatch(payoutId: string): Promise<boolean> {
  if (await isKillSwitchEnabled()) return false;
  const [row] = await dbHttp
    .select({ status: payouts.status })
    .from(payouts)
    .where(eq(payouts.id, payoutId))
    .limit(1);
  return row?.status === "distributing";
}

/**
 * Dispatch a single recipient: either send SOL (wallet linked) or insert an
 * escrow holding (wallet null). Updates payout_recipients.status accordingly.
 *
 * Idempotency: we look up the recipient row first; if it's already
 * sent/confirmed/escrow we skip. The DB UNIQUE(idempotencyKey) is the
 * primary guarantee — this code is best-effort secondary.
 */
export async function dispatchRecipient(args: {
  payoutId: string;
  recipient: DistributionPlanRowJson;
  sourcePayoutId: string;
  escrowDays: number;
}): Promise<{
  status: "sent" | "escrow" | "skipped" | "failed";
  sig?: string;
}> {
  enterDbWorkflowContext("payout-helpers:dispatchRecipient");
  const amount = BigInt(args.recipient.amountLamports);
  if (amount <= 0n) return { status: "skipped" };
  if (!(await payoutCanDispatch(args.payoutId))) {
    return { status: "skipped" };
  }

  // Read existing row state.
  const [existing] = await dbHttp
    .select({
      id: payoutRecipients.id,
      status: payoutRecipients.status,
      sendAttemptId: payoutRecipients.sendAttemptId,
      sendingAt: payoutRecipients.sendingAt,
      txSignature: payoutRecipients.txSignature,
      error: payoutRecipients.error,
    })
    .from(payoutRecipients)
    .where(eq(payoutRecipients.idempotencyKey, args.recipient.idempotencyKey))
    .limit(1);

  if (!existing) return { status: "skipped" };
  if (
    existing.status === "sent" ||
    existing.status === "confirmed" ||
    existing.status === "escrow"
  ) {
    return { status: "skipped" };
  }
  if (
    existing.status === "failed" &&
    existing.error &&
    isManualReconciliationError(existing.error)
  ) {
    return { status: "skipped" };
  }
  if (existing.status === "sending") {
    await markStaleSendingRecipientForReconciliation(existing);
    return { status: "skipped" };
  }

  const attemptId = `payout:${args.payoutId}:${args.recipient.idempotencyKey}`;
  const now = new Date();

  // Wallet not linked -> escrow.
  if (!args.recipient.walletAddress) {
    const expiresAt = new Date(
      Date.now() + Math.max(1, args.escrowDays) * 86_400_000,
    );
    const escrowed = await dbPool().transaction(async (tx) => {
      await applyDbRlsContext(tx, {
        mode: "service",
        reason: "workflow:payout-helpers:dispatchRecipient:escrow",
      });
      const [claimed] = await tx
        .update(payoutRecipients)
        .set({
          status: "sending",
          sendAttemptId: attemptId,
          sendingAt: now,
          error: null,
        })
        .where(
          and(
            eq(payoutRecipients.id, existing.id),
            inArray(payoutRecipients.status, ["pending", "failed"]),
            sql`exists (
              select 1 from payouts p
              where p.id = ${args.payoutId}
                and p.status = 'distributing'
            )`,
          ),
        )
        .returning({ id: payoutRecipients.id });
      if (!claimed) return false;

      await tx.insert(escrowHoldings).values({
        contributorId: args.recipient.contributorId,
        tokenMint: null,
        amountLamports: amount,
        sourcePayoutId: args.sourcePayoutId,
        expiresAt,
      });
      await tx
        .update(payoutRecipients)
        .set({ status: "escrow", sentAt: new Date(), sendAttemptId: null })
        .where(eq(payoutRecipients.id, existing.id));
      return true;
    });
    if (!escrowed) return { status: "skipped" };
    return { status: "escrow" };
  }

  const [claimed] = await dbHttp
    .update(payoutRecipients)
    .set({
      status: "sending",
      sendAttemptId: attemptId,
      sendingAt: now,
      error: null,
    })
    .where(
      and(
        eq(payoutRecipients.id, existing.id),
        inArray(payoutRecipients.status, ["pending", "failed"]),
        sql`exists (
          select 1 from payouts p
          where p.id = ${args.payoutId}
            and p.status = 'distributing'
        )`,
      ),
    )
    .returning({ id: payoutRecipients.id });
  if (!claimed) return { status: "skipped" };

  if (await isKillSwitchEnabled()) {
    await dbHttp
      .update(payoutRecipients)
      .set({
        status: "pending",
        sendAttemptId: null,
        sendingAt: null,
        error: "kill_switch_enabled",
      })
      .where(eq(payoutRecipients.id, existing.id));
    return { status: "skipped" };
  }

  let signature: string;
  try {
    const { PublicKey } = await import("@solana/web3.js");
    const { transferSol } = await import("@/lib/solana/spl-transfer");
    const result = await transferSol(
      new PublicKey(args.recipient.walletAddress),
      amount,
      attemptId,
    );
    signature = result.signature;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await dbHttp
      .update(payoutRecipients)
      .set({
        status: "failed",
        sendAttemptId: null,
        error: message.slice(0, 500),
      })
      .where(eq(payoutRecipients.id, existing.id));
    return { status: "failed" };
  }

  try {
    await markRecipientConfirmedWithRetry(existing.id, signature);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await dbHttp
      .update(payoutRecipients)
      .set({
        status: "failed",
        txSignature: signature,
        sendAttemptId: null,
        sendingAt: null,
        error: message.slice(0, 500),
      })
      .where(eq(payoutRecipients.id, existing.id));
    return { status: "failed", sig: signature };
  }
  return { status: "sent", sig: signature };
}

async function markRecipientConfirmedWithRetry(
  recipientId: string,
  signature: string,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const confirmedAt = new Date();
      await dbHttp
        .update(payoutRecipients)
        .set({
          status: "confirmed",
          txSignature: signature,
          sentAt: confirmedAt,
          confirmedAt,
          sendAttemptId: null,
          sendingAt: null,
          error: null,
        })
        .where(eq(payoutRecipients.id, recipientId));
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  const message =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `${MANUAL_RECONCILIATION_ERROR}:recipient=${recipientId};signature=${signature};${message}`,
  );
}

async function markStaleSendingRecipientForReconciliation(existing: {
  id: string;
  sendAttemptId: string | null;
  sendingAt: Date | null;
  txSignature: string | null;
}): Promise<void> {
  if (existing.txSignature) {
    await markRecipientConfirmedWithRetry(existing.id, existing.txSignature);
    return;
  }
  if (!existing.sendingAt) return;
  if (
    Date.now() - existing.sendingAt.getTime() <
    SENDING_RECONCILIATION_AFTER_MS
  ) {
    return;
  }
  await dbHttp
    .update(payoutRecipients)
    .set({
      status: "failed",
      error: `${MANUAL_RECONCILIATION_ERROR}:attempt=${existing.sendAttemptId ?? "unknown"}`,
    })
    .where(
      and(
        eq(payoutRecipients.id, existing.id),
        eq(payoutRecipients.status, "sending"),
      ),
    );
}

/**
 * Mark the payout completed (or partial-failed) based on per-recipient state.
 *
 * STUB MODE: when `isStubMode()` is true, no on-chain transactions ever ran
 * (dispatchStep was skipped) so the payout terminates with status='simulated'
 * and `simulated_at = now()`. This is a non-real terminal state — every
 * aggregation that filters on status='completed' will correctly skip it.
 */
export async function finalizePayout(payoutId: string): Promise<{
  status: "completed" | "failed" | "pending" | "simulated" | "cancelled";
  totals: {
    sent: number;
    escrow: number;
    failed: number;
    pending: number;
  };
}> {
  enterDbWorkflowContext("payout-helpers:finalizePayout");
  const stub = isStubMode();
  const [payout] = await dbHttp
    .select({ status: payouts.status })
    .from(payouts)
    .where(eq(payouts.id, payoutId))
    .limit(1);
  const rows = await dbHttp
    .select({ status: payoutRecipients.status })
    .from(payoutRecipients)
    .where(eq(payoutRecipients.payoutId, payoutId));

  const totals = { sent: 0, escrow: 0, failed: 0, pending: 0 };
  for (const r of rows) {
    if (r.status === "sent" || r.status === "confirmed") totals.sent++;
    else if (r.status === "escrow") totals.escrow++;
    else if (r.status === "failed") totals.failed++;
    else totals.pending++;
  }

  let status: "completed" | "failed" | "pending" | "simulated" | "cancelled";
  if (payout?.status === "cancelled") {
    status = "cancelled";
  } else if (stub) {
    // dispatchStep was skipped — recipients stay 'pending'. The payout
    // terminates as 'simulated', NOT 'completed', so it never lies to the
    // public ledger.
    status = "simulated";
  } else if (totals.failed > 0 && totals.sent + totals.escrow === 0) {
    status = "failed";
  } else if (totals.pending === 0) {
    status = "completed";
  } else {
    status = "pending";
  }

  const now = new Date();
  await dbHttp
    .update(payouts)
    .set({
      ...(status === "cancelled" ? {} : { status }),
      executedAt: now,
      ...(status === "simulated" ? { simulatedAt: now } : {}),
    })
    .where(eq(payouts.id, payoutId));

  // Mark snapshot 'paid' on real success only — never on simulated.
  if (status === "completed") {
    await dbHttp.execute(sql`
      update snapshots set status = 'paid'
      where id = (select snapshot_id from payouts where id = ${payoutId})
    `);
  }

  return { status, totals };
}

/**
 * Lightweight no-op tx assembly. Kept so static imports stay live during dev.
 */
export async function noopForBuild(): Promise<void> {
  void and;
}

// ============================================================
// Workflow step wrappers — each carries the `"use step"` directive
// so workflows/executePayout.ts can import them and stay free of
// Node-only imports at the file top.
// ============================================================

export type ClaimFeesStepResult =
  | { ok: true; signature: string | null; txCount: number }
  | { ok: false; reason: string; claimSignature: string | null };

export async function payoutAssertNotKilled(): Promise<void> {
  "use step";
  enterDbWorkflowContext("executePayout:assertNotKilled");
  if (await isKillSwitchEnabled()) {
    throw new FatalError("kill_switch_enabled: executePayout aborted");
  }
}

export async function payoutAcquireLockStep(
  workflowName: string,
  scope: string,
  ttlSeconds: number,
): Promise<WorkflowLock> {
  "use step";
  const { acquireWorkflowLock } = await import("@/lib/workflow-locks");
  return await acquireWorkflowLock(workflowName, scope, ttlSeconds);
}

export async function payoutReleaseLockStep(lock: WorkflowLock): Promise<void> {
  "use step";
  const { releaseWorkflowLock } = await import("@/lib/workflow-locks");
  await releaseWorkflowLock(lock);
}

export async function payoutHeartbeatStep(name: string): Promise<void> {
  "use step";
  enterDbWorkflowContext("executePayout:heartbeat");
  const at = new Date().toISOString();
  await dbHttp
    .insert(platformConfig)
    .values({
      key: `heartbeat.${name}`,
      value: { lastBeatAt: at, source: "executePayout" },
    })
    .onConflictDoUpdate({
      target: platformConfig.key,
      set: {
        value: sql`excluded.value`,
        updatedAt: sql`now()`,
      },
    });
}

export async function loadAwaitingStep(): Promise<Array<{ id: string }>> {
  "use step";
  enterDbWorkflowContext("executePayout:loadAwaiting");
  return await loadFrozenSnapshotsAwaitingPayout();
}

export async function loadCtxStep(
  snapshotId: string,
): Promise<SnapshotContextJson | null> {
  "use step";
  enterDbWorkflowContext("executePayout:loadContext");
  return await loadSnapshotContext(snapshotId);
}

export async function stubModeStep(): Promise<boolean> {
  "use step";
  return isStubMode();
}

export async function preflightStep(
  ctx: SnapshotContextJson,
): Promise<
  { ok: true; balanceLamports: string } | { ok: false; reason: string }
> {
  "use step";
  enterDbWorkflowContext("executePayout:preflight");
  return await runPreflight(ctx);
}

export async function platformWalletStep(): Promise<string | null> {
  "use step";
  return payoutSignerPublicKey();
}

export async function claimableStep(args: {
  walletAddress: string | null;
  tokenMint: string | null;
}): Promise<{ lamports: string; positionCount: number }> {
  "use step";
  enterDbWorkflowContext("executePayout:claimable");
  return await checkClaimableLamports(args);
}

export async function claimFeesStep(args: {
  walletAddress: string;
  tokenMint: string;
  idempotencyKey: string;
  payoutId: string;
}): Promise<ClaimFeesStepResult> {
  "use step";
  const { stepId } = getStepMetadata();
  return await withIdempotency(
    `${stepId}:${args.idempotencyKey}`,
    async () => {
      try {
        const result = await claimBagsFees({
          walletAddress: args.walletAddress,
          tokenMint: args.tokenMint,
          payoutId: args.payoutId,
        });
        return { ok: true as const, ...result };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        if (!isManualReconciliationError(reason)) throw error;
        return {
          ok: false as const,
          reason,
          claimSignature:
            extractManualReconciliationClaimSignatures(reason),
        };
      }
    },
    { scope: "workflow:payout:claim" },
  );
}

export async function buildPlanStep(
  ctx: SnapshotContextJson,
  claimedLamports: string,
): Promise<DistributionPlanRowJson[]> {
  "use step";
  enterDbWorkflowContext("executePayout:buildPlan");
  return await buildPlan(ctx, claimedLamports);
}

export async function capCheckStep(
  plan: DistributionPlanRowJson[],
): Promise<{ ok: true; total: string } | { ok: false; reason: string }> {
  "use step";
  enterDbWorkflowContext("executePayout:capCheck");
  return await assertCycleUnderCap(plan);
}

export async function persistStep(args: {
  snapshotId: string;
  projectId: string;
  snapshotPeriod: string;
  plan: DistributionPlanRowJson[];
  claimSignature: string | null;
  totalLamportsStr: string;
  stub: boolean;
  reserveClaimFirst?: boolean;
}): Promise<{ payoutId: string; recipientCount: number }> {
  "use step";
  enterDbWorkflowContext("executePayout:persist");
  return await persistPayoutPlan(args);
}

export async function markPayoutClaimedStep(
  payoutId: string,
  claimSignature: string | null,
): Promise<void> {
  "use step";
  enterDbWorkflowContext("executePayout:markClaimed");
  await markPayoutClaimed(payoutId, claimSignature);
}

export async function markPayoutFailedStep(
  payoutId: string,
  reason: string,
  claimSignature?: string | null,
): Promise<void> {
  "use step";
  enterDbWorkflowContext("executePayout:markFailed");
  await markPayoutFailed(payoutId, reason, { claimSignature });
}

export async function dispatchStep(args: {
  payoutId: string;
  recipient: DistributionPlanRowJson;
  sourcePayoutId: string;
  escrowDays: number;
}): Promise<{ status: string; sig?: string }> {
  "use step";
  enterDbWorkflowContext("executePayout:dispatch");
  const { stepId } = getStepMetadata();
  return await withIdempotency(
    `${stepId}:${args.recipient.idempotencyKey}`,
    async () => {
      try {
        return await dispatchRecipient(args);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        if (!isManualReconciliationError(reason)) throw error;
        return { status: "failed" };
      }
    },
    { scope: "workflow:payout:dispatch" },
  );
}

export async function finalizeStep(payoutId: string): Promise<{
  status: "completed" | "failed" | "pending" | "simulated" | "cancelled";
  totals: { sent: number; escrow: number; failed: number; pending: number };
}> {
  "use step";
  enterDbWorkflowContext("executePayout:finalize");
  return await finalizePayout(payoutId);
}

export async function revalidateProjectCachesStep(
  projectId: string,
): Promise<void> {
  "use step";
  enterDbWorkflowContext("executePayout:revalidateProjectCaches");
  const { revalidateProjectCaches } = await import("@/lib/cache");
  await revalidateProjectCaches(projectId);
}

export async function payoutAuditAbort(
  snapshotId: string,
  reason: string,
): Promise<void> {
  "use step";
  enterDbWorkflowContext("executePayout:auditAbort");
  const { audit } = await import("@/lib/audit");
  await audit({
    actorUserId: null,
    action: "payout.cancel",
    targetType: "snapshot",
    targetId: snapshotId,
    metadata: { reason },
  });
}

export async function payoutAuditCompleted(
  snapshotId: string,
  payoutId: string,
  stub: boolean,
  status: string,
): Promise<void> {
  "use step";
  enterDbWorkflowContext("executePayout:auditCompleted");
  const { audit } = await import("@/lib/audit");
  await audit({
    actorUserId: null,
    action: "payout.trigger",
    targetType: "payout",
    targetId: payoutId,
    metadata: { snapshotId, stub, status },
  });
}

/**
 * `start()` cannot run inside workflow context — wrap it in a step. Spawns the
 * per-snapshot child workflow for each frozen snapshot.
 */
export async function startProcessSnapshotPayoutStep(
  snapshotId: string,
): Promise<void> {
  "use step";
  const { start } = await import("workflow/api");
  const { processSnapshotPayout } = await import("../executePayout");
  await start(processSnapshotPayout, [snapshotId]);
}
