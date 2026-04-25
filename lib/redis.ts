import { Redis } from "@upstash/redis";
import { serverEnv, hasCredentials } from "@/lib/env";

let client: Redis | null = null;

/**
 * Lazy Upstash Redis client. Returns `null` when credentials are absent;
 * callers must guard their usage so the app keeps booting in stubbed mode.
 */
export function redis(): Redis | null {
  if (!hasCredentials.redis()) return null;
  if (client) return client;
  const env = serverEnv();
  client = new Redis({
    url: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return client;
}

export class RedisUnavailableError extends Error {
  constructor() {
    super("Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");
    this.name = "RedisUnavailableError";
  }
}

export function requireRedis(): Redis {
  const r = redis();
  if (!r) throw new RedisUnavailableError();
  return r;
}
