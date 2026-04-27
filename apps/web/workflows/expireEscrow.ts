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

/**
 * expireEscrow — daily root, 01:00 UTC. Sweeps holdings whose grace period
 * has elapsed. v0 retires native SOL escrow with a sentinel; token escrow
 * stays open until an SPL sweep implementation exists.
 */
export async function expireEscrow(): Promise<{ swept: number; failed: number }> {
  await assertNotKilled();
  await heartbeat("escrow");
  const expired = await loadExpiredStep();
  let swept = 0;
  let failed = 0;
  for (const h of expired) {
    const result = await sweepStep(h.id);
    if (result.status === "drained") swept++;
    if (result.status === "failed") failed++;
  }
  await auditSweep({ swept, failed });
  return { swept, failed };
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

async function auditSweep(args: { swept: number; failed: number }): Promise<void> {
  "use step";
  enterDbWorkflowContext("expireEscrow:auditSweep");
  if (args.swept === 0 && args.failed === 0) return;
  await audit({
    actorUserId: null,
    action: "payout.cancel",
    targetType: "escrow",
    targetId: "batch",
    metadata: {
      swept: args.swept,
      failed: args.failed,
      mode: "v0-native-mark-only",
    },
  });
}
