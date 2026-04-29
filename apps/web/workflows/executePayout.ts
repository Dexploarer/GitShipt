import {
  payoutAcquireLockStep,
  payoutReleaseLockStep,
  payoutAssertNotKilled,
  payoutHeartbeatStep,
  loadAwaitingStep,
  loadCtxStep,
  stubModeStep,
  preflightStep,
  platformWalletStep,
  claimableStep,
  claimFeesStep,
  buildPlanStep,
  capCheckStep,
  persistStep,
  markPayoutClaimedStep,
  markPayoutFailedStep,
  dispatchStep,
  finalizeStep,
  revalidateProjectCachesStep,
  payoutAuditAbort,
  payoutAuditCompleted,
  startProcessSnapshotPayoutStep,
  type ClaimFeesStepResult,
} from "@/workflows/steps/payout-helpers";

const ESCROW_DAYS = 30;

/**
 * executePayout — daily root, 00:30 UTC. Fans out one child workflow per
 * frozen snapshot awaiting payout.
 */
export async function executePayout(): Promise<{ count: number }> {
  "use workflow";
  const lock = await payoutAcquireLockStep("executePayout", "root", 20 * 60);
  if (!lock.acquired) return { count: 0 };
  try {
    await payoutAssertNotKilled();
    await payoutHeartbeatStep("payouts");
    const snapshots = await loadAwaitingStep();
    for (const s of snapshots) {
      await startProcessSnapshotPayoutStep(s.id);
    }
    return { count: snapshots.length };
  } finally {
    await payoutReleaseLockStep(lock);
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
  "use workflow";
  const lock = await payoutAcquireLockStep(
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
    await payoutAuditAbort(snapshotId, `preflight:${preflight.reason}`);
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
    await payoutAuditAbort(snapshotId, `below_threshold:${claim.lamports}`);
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
    await payoutAuditAbort(snapshotId, capCheck.reason);
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
      await payoutAuditAbort(snapshotId, "missing_wallet_or_mint");
      return {
        payoutId: persisted.payoutId,
        recipientCount: persisted.recipientCount,
        stub,
        status: "failed",
      };
    }

    let claimResult: ClaimFeesStepResult;
    try {
      claimResult = await claimFeesStep({
        walletAddress: platformWallet,
        tokenMint: ctx.project.tokenMint,
        idempotencyKey: `payout:claim:${ctx.project.id}:${ctx.snapshot.snapshotPeriod}`,
        payoutId: persisted.payoutId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markPayoutFailedStep(persisted.payoutId, message);
      await payoutAuditAbort(snapshotId, `claim_failed:${message.slice(0, 200)}`);
      return {
        payoutId: persisted.payoutId,
        recipientCount: persisted.recipientCount,
        stub,
        status: "failed",
      };
    }
    if (!claimResult.ok) {
      await markPayoutFailedStep(
        persisted.payoutId,
        claimResult.reason,
        claimResult.claimSignature,
      );
      await payoutAuditAbort(
        snapshotId,
        `claim_failed:${claimResult.reason.slice(0, 200)}`,
      );
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
  await payoutAuditCompleted(
    snapshotId,
    persisted.payoutId,
    stub,
    finalized.status,
  );

  return {
    payoutId: persisted.payoutId,
    recipientCount: persisted.recipientCount,
    stub,
    status: finalized.status,
  };
  } finally {
    await payoutReleaseLockStep(lock);
  }
}
