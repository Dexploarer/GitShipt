"use workflow";

import { FatalError } from "workflow";
import { dbHttp } from "@/db";
import { platformConfig } from "@/db/schema";
import { sql } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { isKillSwitchEnabled } from "@/lib/payouts/safety";
import {
  loadExpiredEscrow,
  sweepBackToTreasury,
  type ExpiredEscrowRow,
} from "./steps/escrow-helpers";
import { enterDbWorkflowContext } from "@/lib/db-rls";
import {
  acquireWorkflowLock,
  releaseWorkflowLock,
  type WorkflowLock,
} from "@/lib/workflow-locks";

/**
 * expireEscrow — daily root, 01:00 UTC. Flags holdings whose grace period has
 * elapsed for admin review. It does not silently sweep contributor rewards.
 */
export async function expireEscrow(): Promise<{
  reviewed: number;
  failed: number;
}> {
  const lock = await acquireLockStep("expireEscrow", "root", 20 * 60);
  if (!lock.acquired) return { reviewed: 0, failed: 0 };
  try {
    await assertNotKilled();
    await heartbeat("escrow");
    const expired = await loadExpiredStep();
    let reviewed = 0;
    let failed = 0;
    for (const h of expired) {
      const result = await sweepStep(h.id);
      if (result.status === "skipped") reviewed++;
      if (result.status === "failed") failed++;
    }
    await auditSweep({ reviewed, failed });
    return { reviewed, failed };
  } finally {
    await releaseLockStep(lock);
  }
}

// ============================================================
// Steps
// ============================================================

async function assertNotKilled(): Promise<void> {
  "use step";
  enterDbWorkflowContext("expireEscrow:assertNotKilled");
  if (await isKillSwitchEnabled()) {
    throw new FatalError("kill_switch_enabled: expireEscrow aborted");
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
  enterDbWorkflowContext("expireEscrow:heartbeat");
  const at = new Date().toISOString();
  await dbHttp
    .insert(platformConfig)
    .values({
      key: `heartbeat.${name}`,
      value: { lastBeatAt: at, source: "expireEscrow" },
    })
    .onConflictDoUpdate({
      target: platformConfig.key,
      set: {
        value: sql`excluded.value`,
        updatedAt: sql`now()`,
      },
    });
}

async function loadExpiredStep(): Promise<ExpiredEscrowRow[]> {
  "use step";
  enterDbWorkflowContext("expireEscrow:loadExpired");
  return await loadExpiredEscrow();
}

async function sweepStep(
  holdingId: string,
): ReturnType<typeof sweepBackToTreasury> {
  "use step";
  enterDbWorkflowContext("expireEscrow:sweep");
  return await sweepBackToTreasury(holdingId);
}

async function auditSweep(args: {
  reviewed: number;
  failed: number;
}): Promise<void> {
  "use step";
  enterDbWorkflowContext("expireEscrow:auditSweep");
  if (args.reviewed === 0 && args.failed === 0) return;
  await audit({
    actorUserId: null,
    action: "payout.cancel",
    targetType: "escrow",
    targetId: "batch",
    metadata: {
      reviewed: args.reviewed,
      failed: args.failed,
      mode: "liability-review-only",
    },
  });
}
