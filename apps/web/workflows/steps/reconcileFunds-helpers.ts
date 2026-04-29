import { sql } from "drizzle-orm";
import { dbHttp } from "@/db";
import { platformConfig } from "@/db/schema";
import { enterDbWorkflowContext } from "@/lib/db-rls";
import type { runFundReconciliation } from "@/lib/funds/reconciliation";
import {
  acquireWorkflowLock,
  releaseWorkflowLock,
  type WorkflowLock,
} from "@/lib/workflow-locks";

export type { WorkflowLock };

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

export async function reconcileStep(): ReturnType<typeof runFundReconciliation> {
  "use step";
  enterDbWorkflowContext("reconcileFunds:reconcile");
  // @/lib/funds/reconciliation transitively imports @solana/web3.js;
  // lazy-load so the workflow bundle's static graph never touches it.
  const { runFundReconciliation } = await import("@/lib/funds/reconciliation");
  return await runFundReconciliation();
}

export async function heartbeatStep(status: string): Promise<void> {
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
