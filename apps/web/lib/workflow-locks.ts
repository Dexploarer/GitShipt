import "server-only";

import { randomUUID } from "node:crypto";
import { redis } from "@/lib/redis";
import { serverEnv } from "@/lib/env";
import { captureException } from "@/lib/observability";

export interface WorkflowLock {
  key: string;
  token: string;
  acquired: boolean;
}

export class WorkflowLockUnavailableError extends Error {
  readonly code = "WORKFLOW_LOCK_UNAVAILABLE";
  constructor(message: string) {
    super(message);
    this.name = "WorkflowLockUnavailableError";
  }
}

const DEFAULT_TTL_SECONDS = 15 * 60;

function normalizePart(part: string): string {
  return part.replace(/[^a-zA-Z0-9:_./-]+/g, "_").slice(0, 160);
}

/**
 * Acquire a Redis-backed single-flight lock. Returns `{acquired: false}` if
 * another holder already has the lock; throws WorkflowLockUnavailableError
 * if Redis is unreachable in production. Callers MUST treat a thrown error
 * as a hard abort — running a payout/snapshot without confirmed mutual
 * exclusion is a money-flow correctness violation.
 */
export async function acquireWorkflowLock(
  workflowName: string,
  scope = "global",
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<WorkflowLock> {
  const r = redis();
  if (!r) {
    if (serverEnv().NODE_ENV === "production") {
      throw new WorkflowLockUnavailableError(
        "Redis is required for production workflow locks.",
      );
    }
    return {
      key: `dev:${workflowName}:${scope}`,
      token: "dev-unlocked",
      acquired: true,
    };
  }

  const key = `gitshipt:workflow-lock:${normalizePart(
    workflowName,
  )}:${normalizePart(scope)}`;
  const token = randomUUID();
  let claimed: "OK" | null = null;
  try {
    claimed = (await r.set(
      key,
      token,
      "EX",
      Math.max(1, ttlSeconds),
      "NX",
    )) as "OK" | null;
  } catch (err) {
    // Production: re-throw a tagged error so monitoring can alert. Do NOT
    // fall through to acquired=true, ever. A silent fall-through here would
    // allow parallel payouts.
    captureException(err, {
      area: "workflow-lock.acquire",
      severity: "fatal",
      tags: { workflowName, scope },
    });
    if (serverEnv().NODE_ENV === "production") {
      throw new WorkflowLockUnavailableError(
        `Redis SET failed acquiring lock ${key}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    throw err;
  }
  return { key, token, acquired: claimed === "OK" };
}

export async function releaseWorkflowLock(lock: WorkflowLock): Promise<void> {
  if (!lock.acquired) return;
  const r = redis();
  if (!r || lock.token === "dev-unlocked") return;

  await r.eval(
    `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      end
      return 0
    `,
    1,
    lock.key,
    lock.token,
  );
}
