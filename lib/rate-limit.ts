import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

type LimiterKind =
  | "auth"
  | "siws-verify"
  | "project-create"
  | "force-snapshot"
  | "default";

const SLIDING: Record<LimiterKind, [number, `${number} ${"s" | "m" | "h"}`]> = {
  auth: [5, "1 m"],
  "siws-verify": [10, "1 m"],
  "project-create": [3, "1 h"],
  "force-snapshot": [1, "1 h"],
  default: [60, "1 m"],
};

const cache: Partial<Record<LimiterKind, Ratelimit>> = {};

/**
 * Token-bucket rate limiter keyed by IP or user ID. When Redis is absent
 * (local dev without Upstash creds), `check` returns `{ success: true }` so
 * the app stays responsive — production must always have Redis configured.
 */
export function getLimiter(kind: LimiterKind): Ratelimit | null {
  const r = redis();
  if (!r) return null;
  if (cache[kind]) return cache[kind]!;
  const [n, window] = SLIDING[kind];
  const limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(n, window),
    analytics: true,
    prefix: `gitbags:rl:${kind}`,
  });
  cache[kind] = limiter;
  return limiter;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export async function check(
  kind: LimiterKind,
  identifier: string,
): Promise<RateLimitResult> {
  const limiter = getLimiter(kind);
  if (!limiter) {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}
