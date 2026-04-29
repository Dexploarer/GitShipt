import {
  acquireLockStep,
  releaseLockStep,
  assertNotKilled,
  heartbeat,
  loadExpiredStep,
  sweepStep,
  auditSweep,
} from "@/workflows/steps/expireEscrow-helpers";

/**
 * expireEscrow — daily root, 01:00 UTC. Flags holdings whose grace period has
 * elapsed for admin review. It does not silently sweep contributor rewards.
 */
export async function expireEscrow(): Promise<{
  reviewed: number;
  failed: number;
}> {
  "use workflow";
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
