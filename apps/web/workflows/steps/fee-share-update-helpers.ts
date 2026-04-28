import { createHash } from "node:crypto";
import { dbHttp, dbPool } from "@/db";
import {
  feeShareUpdateAttempts,
  projects,
  type FeeShareUpdatePlanJson,
} from "@/db/schema";
import type { PayoutConfig, ScoringConfig } from "@/db/schema/projects";
import type { LeaderboardEntry } from "@/db/schema/snapshots";
import { bags } from "@/lib/bags/client";
import { buildBagsFeeShareDistributionPlan } from "@/lib/bags/fee-share-distribution";
import { applyDbRlsContext, enterDbWorkflowContext } from "@/lib/db-rls";
import {
  canLaunchOnBags,
  hasCredentials,
  serverEnv,
  stubsAllowed,
} from "@/lib/env";
import { isKillSwitchEnabled } from "@/lib/payouts/safety";
import { solanaConnection } from "@/lib/solana/connection";
import { payoutSignerPublicKey } from "@/lib/solana/signer";
import { and, eq, inArray, sql } from "drizzle-orm";
import { loadContributorWallets } from "./snapshot-helpers";

const MANUAL_RECONCILIATION_ERROR =
  "manual_reconciliation_required_external_side_effect_may_have_succeeded";
const ERROR_LIMIT = 1_000;

export interface FeeShareProjectContext {
  id: string;
  status:
    | "draft"
    | "launch_configured"
    | "live"
    | "paused"
    | "killed"
    | "simulated_live";
  tokenMint: string | null;
  bagsPoolClaimerWallet: string | null;
  platformFeeBps: number;
  scoringConfig: ScoringConfig;
  payoutConfig: PayoutConfig;
}

export interface PreparedFeeShareUpdate {
  attemptId: string | null;
  status: "pending" | "skipped";
  reason?: string;
  targetHash?: string;
}

export interface ExecutedFeeShareUpdate {
  attemptId: string;
  status: "succeeded" | "failed" | "skipped";
  signatures: string[];
  reason?: string;
}

function targetHashFor(plan: FeeShareUpdatePlanJson): string {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex");
}

function skipped(reason: string): PreparedFeeShareUpdate {
  return { attemptId: null, status: "skipped", reason };
}

function liveBagsUpdateReady(): { ok: true } | { ok: false; reason: string } {
  if (!hasCredentials.bags()) return { ok: false, reason: "bags_api_missing" };
  if (!hasCredentials.solana()) return { ok: false, reason: "solana_rpc_missing" };
  if (!hasCredentials.payoutKey()) {
    return { ok: false, reason: "payout_signer_missing" };
  }
  const launchGuard = canLaunchOnBags();
  if (!launchGuard.ok) return { ok: false, reason: launchGuard.reason };
  return { ok: true };
}

/**
 * Reserve a durable DB attempt for a prospective Bags fee-share update.
 * Nothing in this function signs or broadcasts a transaction.
 */
export async function prepareFeeShareUpdateAttempt(args: {
  project: FeeShareProjectContext;
  snapshotId: string;
  snapshotPeriod: string;
  leaderboard: ReadonlyArray<LeaderboardEntry>;
}): Promise<PreparedFeeShareUpdate> {
  enterDbWorkflowContext("fee-share-update:prepare");
  if (args.project.status !== "live") return skipped("project_not_live");
  if (!args.project.tokenMint) return skipped("project_missing_token_mint");
  if (!args.project.bagsPoolClaimerWallet) {
    return skipped("project_missing_pool_claimer");
  }

  const env = serverEnv();
  if (!env.SOLANA_TREASURY_ADDRESS) return skipped("treasury_wallet_missing");

  const payer = payoutSignerPublicKey();
  if (!payer) return skipped("payout_signer_missing");
  if (payer !== args.project.bagsPoolClaimerWallet) {
    return skipped("payout_signer_not_pool_claimer");
  }

  const readiness = liveBagsUpdateReady();
  if (!readiness.ok) {
    if (!stubsAllowed()) return skipped(`live_bags_update_unavailable:${readiness.reason}`);
    return skipped(`stub_mode:${readiness.reason}`);
  }

  const contributorIds = args.leaderboard.map((entry) => entry.contributorId);
  const walletAddresses = await loadContributorWallets(contributorIds);
  const plan = buildBagsFeeShareDistributionPlan({
    leaderboard: args.leaderboard,
    payoutConfig: args.project.payoutConfig,
    walletAddresses,
    platformFeeBps: args.project.platformFeeBps,
    contributorPoolWallet: args.project.bagsPoolClaimerWallet,
    treasuryWallet: env.SOLANA_TREASURY_ADDRESS,
  }) satisfies FeeShareUpdatePlanJson;

  if (
    plan.directContributorBps === 0 &&
    plan.treasuryBps === args.project.platformFeeBps
  ) {
    return skipped("fee_share_config_unchanged_pool_only");
  }

  const targetHash = targetHashFor(plan);
  const attempt = await dbPool().transaction(async (tx) => {
    await applyDbRlsContext(tx, {
      mode: "service",
      reason: "workflow:fee-share-update:prepare",
    });
    const [existing] = await tx
      .select({
        id: feeShareUpdateAttempts.id,
        status: feeShareUpdateAttempts.status,
      })
      .from(feeShareUpdateAttempts)
      .where(
        and(
          eq(feeShareUpdateAttempts.projectId, args.project.id),
          eq(feeShareUpdateAttempts.targetHash, targetHash),
          inArray(feeShareUpdateAttempts.status, [
            "pending",
            "sending",
            "succeeded",
          ]),
        ),
      )
      .limit(1);
    if (existing) return existing;

    const [inserted] = await tx
      .insert(feeShareUpdateAttempts)
      .values({
        projectId: args.project.id,
        snapshotId: args.snapshotId,
        snapshotPeriod: args.snapshotPeriod,
        targetHash,
        plan,
        status: "pending",
      })
      .returning({
        id: feeShareUpdateAttempts.id,
        status: feeShareUpdateAttempts.status,
      });
    if (!inserted) throw new Error("fee_share_update_attempt_insert_failed");
    return inserted;
  });

  return {
    attemptId: attempt.id,
    status: attempt.status === "pending" ? "pending" : "skipped",
    reason:
      attempt.status === "pending"
        ? undefined
        : `existing_fee_share_update_${attempt.status}`,
    targetHash,
  };
}

export async function executeFeeShareUpdateAttempt(
  attemptId: string,
): Promise<ExecutedFeeShareUpdate> {
  enterDbWorkflowContext("fee-share-update:execute");
  if (await isKillSwitchEnabled()) {
    return {
      attemptId,
      status: "skipped",
      signatures: [],
      reason: "kill_switch_enabled",
    };
  }

  const [currentAttempt] = await dbHttp
    .select({
      status: feeShareUpdateAttempts.status,
      signatures: feeShareUpdateAttempts.signatures,
      error: feeShareUpdateAttempts.error,
    })
    .from(feeShareUpdateAttempts)
    .where(eq(feeShareUpdateAttempts.id, attemptId))
    .limit(1);

  if (requiresManualFeeShareReconciliation(currentAttempt)) {
    return {
      attemptId,
      status: "skipped",
      signatures: currentAttempt.signatures,
      reason: "manual_reconciliation_required",
    };
  }

  const [claimed] = await dbHttp
    .update(feeShareUpdateAttempts)
    .set({
      status: "sending",
      attemptCount: sql`${feeShareUpdateAttempts.attemptCount} + 1`,
      startedAt: new Date(),
      error: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(feeShareUpdateAttempts.id, attemptId),
        inArray(feeShareUpdateAttempts.status, ["pending", "failed"]),
      ),
    )
    .returning({
      id: feeShareUpdateAttempts.id,
      plan: feeShareUpdateAttempts.plan,
      projectId: feeShareUpdateAttempts.projectId,
    });

  if (!claimed) {
    return {
      attemptId,
      status: "skipped",
      signatures: [],
      reason: "attempt_not_pending",
    };
  }

  const [project] = await dbHttp
    .select({
      tokenMint: projects.tokenMint,
      bagsPoolClaimerWallet: projects.bagsPoolClaimerWallet,
    })
    .from(projects)
    .where(eq(projects.id, claimed.projectId))
    .limit(1);

  const payer = payoutSignerPublicKey();
  if (!project?.tokenMint || !project.bagsPoolClaimerWallet || !payer) {
    return await markAttemptFailed(attemptId, "missing_project_update_context");
  }
  if (payer !== project.bagsPoolClaimerWallet) {
    return await markAttemptFailed(attemptId, "payout_signer_not_pool_claimer");
  }

  const signatures: string[] = [];
  try {
    const txs = await bags.getUpdateFeeShareConfigTransactions({
      baseMint: project.tokenMint,
      payer,
      feeClaimers: claimed.plan.feeClaimers.map((claimer) => ({
        wallet: claimer.wallet,
        bps: claimer.bps,
      })),
    });
    const conn = solanaConnection("confirmed");
    for (const tx of txs) {
      if (await isKillSwitchEnabled()) {
        throw new Error("kill_switch_enabled");
      }
      const signature = await bags.signAndSubmitTransaction(tx.transaction, {
        operation: "Bags fee-share update transaction",
        bagsInstructionPolicy: "fee-config",
      });
      signatures.push(signature);
      await persistFeeShareSignatures(attemptId, signatures);
      const confirmation = await conn.confirmTransaction(signature, "confirmed");
      if (confirmation.value.err) {
        throw new Error(
          `fee_share_update_confirmation_failed:${JSON.stringify(confirmation.value.err)}`,
        );
      }
    }

    await dbHttp
      .update(feeShareUpdateAttempts)
      .set({
        status: "succeeded",
        signatures,
        completedAt: new Date(),
        updatedAt: new Date(),
        error: null,
      })
      .where(eq(feeShareUpdateAttempts.id, attemptId));

    return { attemptId, status: "succeeded", signatures };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const reason =
      signatures.length > 0
        ? manualReconciliationReason(message, signatures)
        : message;
    return await markAttemptFailed(attemptId, reason, signatures);
  }
}

async function markAttemptFailed(
  attemptId: string,
  reason: string,
  signatures: ReadonlyArray<string> = [],
): Promise<ExecutedFeeShareUpdate> {
  await dbHttp
    .update(feeShareUpdateAttempts)
    .set({
      status: "failed",
      ...(signatures.length > 0 ? { signatures: [...signatures] } : {}),
      error: reason.slice(0, ERROR_LIMIT),
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(feeShareUpdateAttempts.id, attemptId));
  return { attemptId, status: "failed", signatures: [...signatures], reason };
}

async function persistFeeShareSignatures(
  attemptId: string,
  signatures: ReadonlyArray<string>,
): Promise<void> {
  await dbHttp
    .update(feeShareUpdateAttempts)
    .set({
      signatures: [...signatures],
      updatedAt: new Date(),
    })
    .where(eq(feeShareUpdateAttempts.id, attemptId));
}

function requiresManualFeeShareReconciliation(
  attempt:
    | {
        status: "pending" | "sending" | "succeeded" | "failed" | "skipped";
        signatures: string[];
        error: string | null;
      }
    | undefined,
): attempt is {
  status: "failed";
  signatures: string[];
  error: string | null;
} {
  if (!attempt || attempt.status !== "failed") return false;
  return (
    attempt.signatures.length > 0 ||
    attempt.error?.includes(MANUAL_RECONCILIATION_ERROR) === true
  );
}

function manualReconciliationReason(
  message: string,
  signatures: ReadonlyArray<string>,
): string {
  return `${MANUAL_RECONCILIATION_ERROR}:fee_share_update_signatures=${signatures.join(",")};${message}`;
}
