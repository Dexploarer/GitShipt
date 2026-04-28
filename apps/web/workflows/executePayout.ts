"use workflow";

import { FatalError, getStepMetadata } from "workflow";
import { start } from "workflow/api";
import { dbHttp } from "@/db";
import { platformConfig } from "@/db/schema";
import { sql } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { isKillSwitchEnabled } from "@/lib/payouts/safety";
import { payoutSignerPublicKey } from "@/lib/solana/signer";
import {
  loadFrozenSnapshotsAwaitingPayout,
  loadSnapshotContext,
  runPreflight,
  isStubMode,
  checkClaimableLamports,
  claimBagsFees,
  buildPlan,
  assertCycleUnderCap,
  persistPayoutPlan,
  dispatchRecipient,
  finalizePayout,
  type SnapshotContextJson,
  type DistributionPlanRowJson,
} from "./steps/payout-helpers";
import { revalidateProjectCaches } from "@/lib/cache";
import { withIdempotency } from "@/lib/idempotency";
import { enterDbWorkflowContext } from "@/lib/db-rls";
import {
  acquireWorkflowLock,
  releaseWorkflowLock,
  type WorkflowLock,
} from "@/lib/workflow-locks";

const ESCROW_DAYS = 30;

/**
 * executePayout — daily root, 00:30 UTC. Fans out one child workflow per
 * frozen snapshot awaiting payout.
 */
export async function executePayout(): Promise<{ count: number }> {
  const lock = await acquireLockStep("executePayout", "root", 20 * 60);
  if (!lock.acquired) return { count: 0 };
  try {
    await assertNotKilled();
    await heartbeat("payouts");
    const snapshots = await loadAwaitingStep();
    for (const s of snapshots) {
      await start(processSnapshotPayout, [s.id]);
    }
    return { count: snapshots.length };
  } finally {
    await releaseLockStep(lock);
  }
}

/**
 * Per-snapshot pipeline:
 *   1. Load context
 *   2. Preflight safety (kill switch, balance, status)
 *   3. Check claimable lamports against threshold
 *   4. Build distribution plan + cycle-cap check
 *   5. Reserve payout + recipients in the DB
 *   6. Claim Bags fees on-chain (if not stub)
 *   7. Mark the reserved payout as claimed/distributing
 *   8. Per-recipient dispatch (if not stub)
 *   9. Finalize payout state
 */
export async function processSnapshotPayout(snapshotId: string): Promise<{
  payoutId: string;
  recipientCount: number;
  stub: boolean;
  status:
    | "completed"
    | "failed"
    | "pending"
    | "simulated"
    | "cancelled"
    | "skipped";
}> {
  const lock = await acquireLockStep(
    "processSnapshotPayout",
    snapshotId,
    30 * 60,
  );
  if (!lock.acquired) {
    return {
      payoutId: "",
      recipientCount: 0,
      stub: true,
      status: "skipped",
    };
  }

  try {
  const ctx = await loadCtxStep(snapshotId);
  if (!ctx) {
    return {
      payoutId: "",
      recipientCount: 0,
      stub: true,
      status: "skipped",
    };
  }

  const stub = await stubModeStep();

  const preflight = await preflightStep(ctx);
  if (!preflight.ok) {
    await auditAbort(snapshotId, `preflight:${preflight.reason}`);
    return {
      payoutId: "",
      recipientCount: 0,
      stub: true,
      status: "skipped",
    };
  }

  const platformWallet = await platformWalletStep();
  const claim = await claimableStep({
    walletAddress: stub ? null : platformWallet,
    tokenMint: ctx.project.tokenMint,
  });

  const threshold = BigInt(ctx.project.payoutConfig.claimThresholdLamports);
  if (BigInt(claim.lamports) < threshold) {
    await auditAbort(snapshotId, `below_threshold:${claim.lamports}`);
    return {
      payoutId: "",
      recipientCount: 0,
      stub,
      status: "skipped",
    };
  }

  const plan = await buildPlanStep(ctx, claim.lamports);

  const capCheck = await capCheckStep(plan);
  if (!capCheck.ok) {
    await auditAbort(snapshotId, capCheck.reason);
    return {
      payoutId: "",
      recipientCount: 0,
      stub,
      status: "failed",
    };
  }

  const persisted = await persistStep({
    snapshotId,
    projectId: ctx.project.id,
    snapshotPeriod: ctx.snapshot.snapshotPeriod,
    plan,
    claimSignature: null,
    totalLamportsStr: capCheck.total,
    stub,
    reserveClaimFirst: !stub,
  });

  if (!stub) {
    if (!platformWallet || !ctx.project.tokenMint) {
      await markPayoutFailedStep(persisted.payoutId, "missing_wallet_or_mint");
      await auditAbort(snapshotId, "missing_wallet_or_mint");
      return {
        payoutId: persisted.payoutId,
        recipientCount: persisted.recipientCount,
        stub,
        status: "failed",
      };
    }

    let claimResult: { signature: string | null; txCount: number };
    try {
      claimResult = await claimFeesStep({
        walletAddress: platformWallet,
        tokenMint: ctx.project.tokenMint,
        idempotencyKey: `payout:claim:${ctx.project.id}:${ctx.snapshot.snapshotPeriod}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markPayoutFailedStep(persisted.payoutId, message);
      await auditAbort(snapshotId, `claim_failed:${message.slice(0, 200)}`);
      return {
        payoutId: persisted.payoutId,
        recipientCount: persisted.recipientCount,
        stub,
        status: "failed",
      };
    }
    await markPayoutClaimedStep(persisted.payoutId, claimResult.signature);

    for (const r of plan) {
      await dispatchStep({
        payoutId: persisted.payoutId,
        recipient: r,
        sourcePayoutId: persisted.payoutId,
        escrowDays: ESCROW_DAYS,
      });
    }
  }

  const finalized = await finalizeStep(persisted.payoutId);
  await revalidateProjectCachesStep(ctx.project.id);
  await auditCompleted(snapshotId, persisted.payoutId, stub, finalized.status);

  return {
    payoutId: persisted.payoutId,
    recipientCount: persisted.recipientCount,
    stub,
    status: finalized.status,
  };
  } finally {
    await releaseLockStep(lock);
  }
}

// ============================================================
// Steps
// ============================================================

async function assertNotKilled(): Promise<void> {
  "use step";
  enterDbWorkflowContext("executePayout:assertNotKilled");
  if (await isKillSwitchEnabled()) {
    throw new FatalError("kill_switch_enabled: executePayout aborted");
  }
}

async function acquireLockStep(
  workflowName: string,
  scope: string,
  ttlSeconds: number,
): Promise<WorkflowLock> {
  "use step";
  return await acquireWorkflowLock(workflowName, scope, ttlSeconds);
}

async function releaseLockStep(lock: WorkflowLock): Promise<void> {
  "use step";
  await releaseWorkflowLock(lock);
}

async function heartbeat(name: string): Promise<void> {
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

async function loadAwaitingStep(): Promise<Array<{ id: string }>> {
  "use step";
  enterDbWorkflowContext("executePayout:loadAwaiting");
  return await loadFrozenSnapshotsAwaitingPayout();
}

async function loadCtxStep(
  snapshotId: string,
): Promise<SnapshotContextJson | null> {
  "use step";
  enterDbWorkflowContext("executePayout:loadContext");
  return await loadSnapshotContext(snapshotId);
}

async function stubModeStep(): Promise<boolean> {
  "use step";
  return isStubMode();
}

async function preflightStep(
  ctx: SnapshotContextJson,
): Promise<
  { ok: true; balanceLamports: string } | { ok: false; reason: string }
> {
  "use step";
  enterDbWorkflowContext("executePayout:preflight");
  return await runPreflight(ctx);
}

async function platformWalletStep(): Promise<string | null> {
  "use step";
  return payoutSignerPublicKey();
}

async function claimableStep(args: {
  walletAddress: string | null;
  tokenMint: string | null;
}): Promise<{ lamports: string; positionCount: number }> {
  "use step";
  enterDbWorkflowContext("executePayout:claimable");
  return await checkClaimableLamports(args);
}

async function claimFeesStep(args: {
  walletAddress: string;
  tokenMint: string;
  idempotencyKey: string;
}): Promise<{ signature: string | null; txCount: number }> {
  "use step";
  const { stepId } = getStepMetadata();
  return await withIdempotency(
    `${stepId}:${args.idempotencyKey}`,
    () =>
      claimBagsFees({
        walletAddress: args.walletAddress,
        tokenMint: args.tokenMint,
      }),
    { scope: "workflow:payout:claim" },
  );
}

async function buildPlanStep(
  ctx: SnapshotContextJson,
  claimedLamports: string,
): Promise<DistributionPlanRowJson[]> {
  "use step";
  enterDbWorkflowContext("executePayout:buildPlan");
  return await buildPlan(ctx, claimedLamports);
}

async function capCheckStep(
  plan: DistributionPlanRowJson[],
): Promise<{ ok: true; total: string } | { ok: false; reason: string }> {
  "use step";
  enterDbWorkflowContext("executePayout:capCheck");
  return await assertCycleUnderCap(plan);
}

async function persistStep(args: {
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

async function markPayoutClaimedStep(
  payoutId: string,
  claimSignature: string | null,
): Promise<void> {
  "use step";
  enterDbWorkflowContext("executePayout:markClaimed");
  const { markPayoutClaimed } = await import("./steps/payout-helpers");
  await markPayoutClaimed(payoutId, claimSignature);
}

async function markPayoutFailedStep(
  payoutId: string,
  reason: string,
): Promise<void> {
  "use step";
  enterDbWorkflowContext("executePayout:markFailed");
  const { markPayoutFailed } = await import("./steps/payout-helpers");
  await markPayoutFailed(payoutId, reason);
}

async function dispatchStep(args: {
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
    () => dispatchRecipient(args),
    { scope: "workflow:payout:dispatch" },
  );
}

async function finalizeStep(payoutId: string): Promise<{
  status: "completed" | "failed" | "pending" | "simulated" | "cancelled";
  totals: { sent: number; escrow: number; failed: number; pending: number };
}> {
  "use step";
  enterDbWorkflowContext("executePayout:finalize");
  return await finalizePayout(payoutId);
}

async function revalidateProjectCachesStep(projectId: string): Promise<void> {
  "use step";
  enterDbWorkflowContext("executePayout:revalidateProjectCaches");
  await revalidateProjectCaches(projectId);
}

async function auditAbort(snapshotId: string, reason: string): Promise<void> {
  "use step";
  enterDbWorkflowContext("executePayout:auditAbort");
  await audit({
    actorUserId: null,
    action: "payout.cancel",
    targetType: "snapshot",
    targetId: snapshotId,
    metadata: { reason },
  });
}

async function auditCompleted(
  snapshotId: string,
  payoutId: string,
  stub: boolean,
  status: string,
): Promise<void> {
  "use step";
  enterDbWorkflowContext("executePayout:auditCompleted");
  await audit({
    actorUserId: null,
    action: "payout.trigger",
    targetType: "payout",
    targetId: payoutId,
    metadata: { snapshotId, stub, status },
  });
}
