"use workflow";

import { FatalError } from "workflow";
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

const ESCROW_DAYS = 30;

/**
 * executePayout — daily root, 00:30 UTC. Fans out one child workflow per
 * frozen snapshot awaiting payout.
 */
export async function executePayout(): Promise<{ count: number }> {
  await assertNotKilled();
  await heartbeat("payouts");
  const snapshots = await loadAwaitingStep();
  for (const s of snapshots) {
    await start(processSnapshotPayout, [s.id]);
  }
  return { count: snapshots.length };
}

/**
 * Per-snapshot pipeline:
 *   1. Load context
 *   2. Preflight safety (kill switch, balance, status)
 *   3. Check claimable lamports against threshold
 *   4. Stub mode? skip on-chain claim
 *   5. Claim Bags fees on-chain (if not stub)
 *   6. Build distribution plan + cycle-cap check
 *   7. Persist payout + recipients (transactional)
 *   8. Per-recipient dispatch (if not stub)
 *   9. Finalize payout state
 */
export async function processSnapshotPayout(snapshotId: string): Promise<{
  payoutId: string;
  recipientCount: number;
  stub: boolean;
  status: "completed" | "failed" | "pending" | "simulated" | "skipped";
}> {
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

  let claimSig: string | null = null;
  if (!stub) {
    if (!platformWallet || !ctx.project.tokenMint) {
      await auditAbort(snapshotId, "missing_wallet_or_mint");
      return {
        payoutId: "",
        recipientCount: 0,
        stub,
        status: "skipped",
      };
    }
    const claimResult = await claimFeesStep({
      walletAddress: platformWallet,
      tokenMint: ctx.project.tokenMint,
    });
    claimSig = claimResult.signature;
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
    plan,
    claimSignature: claimSig,
    totalLamportsStr: capCheck.total,
    stub,
  });

  if (!stub) {
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
  await auditCompleted(snapshotId, persisted.payoutId, stub, finalized.status);

  return {
    payoutId: persisted.payoutId,
    recipientCount: persisted.recipientCount,
    stub,
    status: finalized.status,
  };
}

// ============================================================
// Steps
// ============================================================

async function assertNotKilled(): Promise<void> {
  "use step";
  if (await isKillSwitchEnabled()) {
    throw new FatalError("kill_switch_enabled: executePayout aborted");
  }
}

async function heartbeat(name: string): Promise<void> {
  "use step";
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
  return await loadFrozenSnapshotsAwaitingPayout();
}

async function loadCtxStep(
  snapshotId: string,
): Promise<SnapshotContextJson | null> {
  "use step";
  return await loadSnapshotContext(snapshotId);
}

async function stubModeStep(): Promise<boolean> {
  "use step";
  return isStubMode();
}

async function preflightStep(ctx: SnapshotContextJson): Promise<
  | { ok: true; balanceLamports: string }
  | { ok: false; reason: string }
> {
  "use step";
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
  return await checkClaimableLamports(args);
}

async function claimFeesStep(args: {
  walletAddress: string;
  tokenMint: string;
}): Promise<{ signature: string | null; txCount: number }> {
  "use step";
  return await claimBagsFees(args);
}

async function buildPlanStep(
  ctx: SnapshotContextJson,
  claimedLamports: string,
): Promise<DistributionPlanRowJson[]> {
  "use step";
  return await buildPlan(ctx, claimedLamports);
}

async function capCheckStep(plan: DistributionPlanRowJson[]): Promise<
  { ok: true; total: string } | { ok: false; reason: string }
> {
  "use step";
  return await assertCycleUnderCap(plan);
}

async function persistStep(args: {
  snapshotId: string;
  projectId: string;
  plan: DistributionPlanRowJson[];
  claimSignature: string | null;
  totalLamportsStr: string;
  stub: boolean;
}): Promise<{ payoutId: string; recipientCount: number }> {
  "use step";
  return await persistPayoutPlan(args);
}

async function dispatchStep(args: {
  payoutId: string;
  recipient: DistributionPlanRowJson;
  sourcePayoutId: string;
  escrowDays: number;
}): Promise<{ status: string; sig?: string }> {
  "use step";
  return await dispatchRecipient(args);
}

async function finalizeStep(payoutId: string): Promise<{
  status: "completed" | "failed" | "pending" | "simulated";
  totals: { sent: number; escrow: number; failed: number; pending: number };
}> {
  "use step";
  return await finalizePayout(payoutId);
}

async function auditAbort(snapshotId: string, reason: string): Promise<void> {
  "use step";
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
  await audit({
    actorUserId: null,
    action: "payout.trigger",
    targetType: "payout",
    targetId: payoutId,
    metadata: { snapshotId, stub, status },
  });
}
