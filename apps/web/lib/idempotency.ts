import { redis } from "@/lib/redis";
import { serverEnv } from "@/lib/env";

const TTL_SECONDS = 60 * 60 * 24; // 24 hours
const RUNNING_VALUE = "running";
const NO_REPLAY_VALUE = JSON.stringify({ status: "completed_no_replay" });

export class IdempotencyReplayError extends Error {
  readonly code = "IDEMPOTENCY_REPLAY";

  constructor(message = "Idempotent operation already completed") {
    super(message);
    this.name = "IdempotencyReplayError";
  }
}

interface IdempotencyOptions {
  /**
   * Scope keys by operation/user/project so caller-supplied keys cannot collide
   * across unrelated mutations.
   */
  scope?: string;
  /**
   * Set false for one-time secrets. The operation is still deduped, but the
   * response is not replayable because replaying would require storing the
   * secret in Redis.
   */
  cacheResult?: boolean;
  ttlSeconds?: number;
}

/**
 * Idempotency wrapper for mutating routes / Server Actions.
 * Pass an `Idempotency-Key` header value as `key`. If the key has been seen,
 * the cached result is returned. Otherwise the function runs and the result
 * is cached for 24 hours.
 *
 * When Redis is absent, this is a passthrough — production must have Redis.
 */
export async function withIdempotency<T>(
  key: string | null,
  fn: () => Promise<T>,
  options: IdempotencyOptions = {},
): Promise<T> {
  if (!key) return fn();
  const r = redis();
  if (!r) {
    if (serverEnv().NODE_ENV === "production") {
      throw new IdempotencyReplayError(
        "Redis is required for production idempotency",
      );
    }
    return fn();
  }

  const ttlSeconds = options.ttlSeconds ?? TTL_SECONDS;
  const cacheKey = `gitshipt:idem:${options.scope ?? "global"}:${key}`;
  const cachedRaw = await r.get(cacheKey);
  if (cachedRaw) {
    if (cachedRaw === RUNNING_VALUE) {
      throw new IdempotencyReplayError(
        "Idempotent operation is already running",
      );
    }
    if (cachedRaw === NO_REPLAY_VALUE) {
      throw new IdempotencyReplayError();
    }
    try {
      return JSON.parse(cachedRaw) as T;
    } catch {
      throw new IdempotencyReplayError("Idempotent result is unavailable");
    }
  }

  const claimed = await r.set(cacheKey, RUNNING_VALUE, "EX", ttlSeconds, "NX");
  if (!claimed) {
    throw new IdempotencyReplayError("Idempotent operation is already running");
  }

  if (options.cacheResult === false) {
    try {
      const result = await fn();
      await r.set(cacheKey, NO_REPLAY_VALUE, "EX", ttlSeconds);
      return result;
    } catch (error) {
      await r.del(cacheKey);
      throw error;
    }
  }

  try {
    const result = await fn();
    await r.set(cacheKey, JSON.stringify(result), "EX", ttlSeconds);
    return result;
  } catch (error) {
    await r.del(cacheKey);
    throw error;
  }
}

/**
 * Build a deterministic idempotency key from inputs. Use for cron-driven
 * work where the natural key is e.g. snapshot_id + contributor_id.
 */
export function deriveKey(...parts: (string | number)[]): string {
  return parts.map((p) => String(p)).join(":");
}
