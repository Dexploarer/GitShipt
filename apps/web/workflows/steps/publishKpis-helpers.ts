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

export type { WorkflowLock };

export const TICKER_REDIS_KEY = "gitshipt:ticker:landing:v2";
export const TICKER_TTL_SECONDS = 120;

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

export async function snapshotTicker(): Promise<void> {
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
