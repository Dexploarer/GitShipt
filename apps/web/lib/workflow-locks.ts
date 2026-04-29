import "server-only";

import { randomUUID } from "node:crypto";
import { redis } from "@/lib/redis";
import { serverEnv } from "@/lib/env";

export interface WorkflowLock {
  key: string;
  token: string;
  acquired: boolean;
}

const DEFAULT_TTL_SECONDS = 15 * 60;

function normalizePart(part: string): string {
  return part.replace(/[^a-zA-Z0-9:_./-]+/g, "_").slice(0, 160);
}

export async function acquireWorkflowLock(
  workflowName: string,
  scope = "global",
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<WorkflowLock> {
  const r = redis();
  if (!r) {
    if (serverEnv().NODE_ENV === "production") {
      throw new Error("Redis is required for production workflow locks.");
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
  const claimed = await r.set(
    key,
    token,
    "EX",
    Math.max(1, ttlSeconds),
    "NX",
  );
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
