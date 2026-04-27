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
 * has elapsed. v0 just marks them drained with a sentinel; the actual
 * on-chain treasury sweep is a v1.1 concern (per PRD).
 */
export async function expireEscrow(): Promise<{ swept: number }> {
  await assertNotKilled();
  await heartbeat("escrow");
  const expired = await loadExpiredStep();
  let swept = 0;
  for (const h of expired) {
    await sweepStep(h.id);
    swept++;
  }
  await auditSweep(swept);
  return { swept };
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

async function sweepStep(holdingId: string): Promise<void> {
  "use step";
  enterDbWorkflowContext("expireEscrow:sweep");
  await sweepBackToTreasury(holdingId);
}

async function auditSweep(swept: number): Promise<void> {
  "use step";
  enterDbWorkflowContext("expireEscrow:auditSweep");
  if (swept === 0) return;
  await audit({
    actorUserId: null,
    action: "payout.cancel",
    targetType: "escrow",
    targetId: "batch",
    metadata: { swept, mode: "v0-mark-only" },
  });
}
