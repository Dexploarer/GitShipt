"use workflow";

import { getStepMetadata } from "workflow";
import { getLiveTickerData, type LandingTicker } from "@/lib/queries/global";
import { enterDbWorkflowContext } from "@/lib/db-rls";

/**
 * publishKpis — minute-level landing ticker snapshot.
 *
 * Reads the same aggregates as `getLandingData()`'s ticker block via the
 * dedicated `getLiveTickerData()` helper, then writes a JSON snapshot to
 * Redis at `gitbags:ticker:landing` with a 120s TTL so a single missed
 * cron beat doesn't blank the homepage. The landing page reads this cache
 * inside `getLandingData()` and merges it into the response when present.
 *
 * Idempotency: every external write is keyed by `getStepMetadata().stepId`
 * which the workflow runtime stamps per-attempt. We embed it in the cached
 * payload so duplicate runs are observable in the snapshot itself.
 */

const TICKER_REDIS_KEY = "gitbags:ticker:landing";
const TICKER_TTL_SECONDS = 120;

interface CachedTickerSnapshot {
  ticker: {
    volume24hUsd: number;
    /** Serialized as string because JSON has no bigint. */
    lifetimeFeesLamports: string;
    activeProjects: number;
    contributorsEarning: number;
  };
  publishedAt: string;
  stepId: string;
}

export async function publishKpis(): Promise<{ ok: true; key: string }> {
  await snapshotTicker();
  return { ok: true, key: TICKER_REDIS_KEY };
}

async function snapshotTicker(): Promise<void> {
  "use step";
  enterDbWorkflowContext("publishKpis:snapshotTicker");

  const stepId = getStepMetadata().stepId;

  const ticker: LandingTicker = await getLiveTickerData();

  const { redis } = await import("@/lib/redis");
  const r = redis();
  if (!r) {
    // No Redis configured — caller falls back to live DB read.
    return;
  }

  const payload: CachedTickerSnapshot = {
    ticker: {
      volume24hUsd: ticker.volume24hUsd,
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
