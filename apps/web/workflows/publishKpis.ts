"use workflow";

import { getStepMetadata } from "workflow";
import {
  getLiveTickerDataUncached,
  type LandingTicker,
} from "@/lib/queries/global";
import { enterDbWorkflowContext } from "@/lib/db-rls";
import {
  acquireWorkflowLock,
  releaseWorkflowLock,
  type WorkflowLock,
} from "@/lib/workflow-locks";

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

const TICKER_REDIS_KEY = "gitshipt:ticker:landing:v2";
const TICKER_TTL_SECONDS = 120;

interface CachedTickerSnapshot {
  ticker: {
    volume24hUsd: number | null;
    volumeSource: LandingTicker["volumeSource"];
    /** Serialized as string because JSON has no bigint. */
    lifetimeFeesLamports: string;
    activeProjects: number;
    contributorsEarning: number;
  };
  publishedAt: string;
  stepId: string;
}

export async function publishKpis(): Promise<{ ok: true; key: string }> {
  const lock = await acquireLockStep("publishKpis", "root", 2 * 60);
  if (!lock.acquired) return { ok: true, key: TICKER_REDIS_KEY };
  try {
    await snapshotTicker();
    return { ok: true, key: TICKER_REDIS_KEY };
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

async function snapshotTicker(): Promise<void> {
  "use step";
  enterDbWorkflowContext("publishKpis:snapshotTicker");

  const stepId = getStepMetadata().stepId;

  const ticker: LandingTicker = await getLiveTickerDataUncached();

  const { redis } = await import("@/lib/redis");
  const r = redis();
  if (!r) {
    // No Redis configured — caller falls back to live DB read.
    return;
  }

  const payload: CachedTickerSnapshot = {
    ticker: {
      volume24hUsd: ticker.volume24hUsd,
      volumeSource: ticker.volumeSource,
      lifetimeFeesLamports: ticker.lifetimeFeesLamports.toString(),
      activeProjects: ticker.activeProjects,
      contributorsEarning: ticker.contributorsEarning,
    },
    publishedAt: new Date().toISOString(),
    stepId,
  };

  await r.set(
    TICKER_REDIS_KEY,
    JSON.stringify(payload),
    "EX",
    TICKER_TTL_SECONDS,
  );
}
