import { redis } from "@/lib/redis";

const TTL_SECONDS = 60 * 60 * 24; // 24 hours

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
): Promise<T> {
  if (!key) return fn();
  const r = redis();
  if (!r) return fn();

  const cacheKey = `gitbags:idem:${key}`;
  const cachedRaw = await r.get(cacheKey);
  if (cachedRaw) {
    try {
      return JSON.parse(cachedRaw) as T;
    } catch {
      // fall through and re-run
    }
  }

  const result = await fn();
  await r.set(cacheKey, JSON.stringify(result), "EX", TTL_SECONDS);
  return result;
}

/**
 * Build a deterministic idempotency key from inputs. Use for cron-driven
 * work where the natural key is e.g. snapshot_id + contributor_id.
 */
export function deriveKey(...parts: (string | number)[]): string {
  return parts.map((p) => String(p)).join(":");
}
