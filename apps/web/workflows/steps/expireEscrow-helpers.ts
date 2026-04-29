import { FatalError } from "workflow";
import { sql } from "drizzle-orm";
import { dbHttp } from "@/db";
import { platformConfig } from "@/db/schema";
import { audit } from "@/lib/audit";
import { enterDbWorkflowContext } from "@/lib/db-rls";
import {
  acquireWorkflowLock,
  releaseWorkflowLock,
  type WorkflowLock,
} from "@/lib/workflow-locks";
import {
  loadExpiredEscrow,
  sweepBackToTreasury,
  type ExpiredEscrowRow,
} from "./escrow-helpers";

export type { WorkflowLock, ExpiredEscrowRow };

export async function assertNotKilled(): Promise<void> {
  "use step";
  enterDbWorkflowContext("expireEscrow:assertNotKilled");
  // @/lib/payouts/safety transitively imports @solana/web3.js; lazy-load
  // here so the workflow bundle's static graph never touches it.
  const { isKillSwitchEnabled } = await import("@/lib/payouts/safety");
  if (await isKillSwitchEnabled()) {
    throw new FatalError("kill_switch_enabled: expireEscrow aborted");
  }
}

export async function acquireLockStep(
  workflowName: string,
  scope: string,
  ttlSeconds: number,
): Promise<WorkflowLock> {
  "use step";
  return await acquireWorkflowLock(workflowName, scope, ttlSeconds);
}

export async function releaseLockStep(lock: WorkflowLock): Promise<void> {
  "use step";
  await releaseWorkflowLock(lock);
}

export async function heartbeat(name: string): Promise<void> {
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

export async function loadExpiredStep(): Promise<ExpiredEscrowRow[]> {
  "use step";
  enterDbWorkflowContext("expireEscrow:loadExpired");
  return await loadExpiredEscrow();
}

export async function sweepStep(
  holdingId: string,
): ReturnType<typeof sweepBackToTreasury> {
  "use step";
  enterDbWorkflowContext("expireEscrow:sweep");
  return await sweepBackToTreasury(holdingId);
}

export async function auditSweep(args: {
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
