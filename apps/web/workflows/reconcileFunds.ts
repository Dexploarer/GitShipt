"use workflow";

import { dbHttp } from "@/db";
import { platformConfig } from "@/db/schema";
import { enterDbWorkflowContext } from "@/lib/db-rls";
import { runFundReconciliation } from "@/lib/funds/reconciliation";
import {
  acquireWorkflowLock,
  releaseWorkflowLock,
  type WorkflowLock,
} from "@/lib/workflow-locks";
import { sql } from "drizzle-orm";

export async function reconcileFunds(): Promise<{
  status: "clean" | "warning" | "critical";
  manualReviewCount: number;
  finalizedSignatureCount: number;
}> {
  const lock = await acquireLockStep("reconcileFunds", "root", 15 * 60);
  if (!lock.acquired) {
    return {
      status: "warning",
      manualReviewCount: 0,
      finalizedSignatureCount: 0,
    };
  }
  try {
    const result = await reconcileStep();
    await heartbeatStep(result.status);
    return {
      status: result.status,
      manualReviewCount: result.manualReviewCount,
      finalizedSignatureCount: result.finalizedSignatureCount,
    };
  } finally {
    await releaseLockStep(lock);
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

async function reconcileStep(): ReturnType<typeof runFundReconciliation> {
  "use step";
  enterDbWorkflowContext("reconcileFunds:reconcile");
  return await runFundReconciliation();
}

async function heartbeatStep(status: string): Promise<void> {
  "use step";
  enterDbWorkflowContext("reconcileFunds:heartbeat");
  await dbHttp
    .insert(platformConfig)
    .values({
      key: "heartbeat.fund_reconciliation",
      value: { lastBeatAt: new Date().toISOString(), status },
    })
    .onConflictDoUpdate({
      target: platformConfig.key,
      set: {
        value: sql`excluded.value`,
        updatedAt: sql`now()`,
      },
    });
}
