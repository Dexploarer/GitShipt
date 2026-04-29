import {
  acquireLockStep,
  releaseLockStep,
  snapshotTicker,
  TICKER_REDIS_KEY,
} from "@/workflows/steps/publishKpis-helpers";

/**
 * publishKpis — minute-level landing ticker snapshot.
 *
 * Reads the same aggregates as `getLandingData()`'s ticker block via the
 * uncached ticker helper, then writes a JSON snapshot to
 * Redis at `gitshipt:ticker:landing:v2` with a 120s TTL so a single missed
 * cron beat doesn't blank the homepage. The landing page reads this cache
 * inside `getLandingData()` and merges it into the response when present.
 *
 * Idempotency: every external write is keyed by `getStepMetadata().stepId`
 * which the workflow runtime stamps per-attempt. We embed it in the cached
 * payload so duplicate runs are observable in the snapshot itself.
 */
export async function publishKpis(): Promise<{ ok: true; key: string }> {
  "use workflow";
  const lock = await acquireLockStep("publishKpis", "root", 2 * 60);
  if (!lock.acquired) return { ok: true, key: TICKER_REDIS_KEY };
  try {
    await snapshotTicker();
    return { ok: true, key: TICKER_REDIS_KEY };
  } finally {
    await releaseLockStep(lock);
  }
}
