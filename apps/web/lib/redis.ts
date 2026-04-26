import IORedis, { type Redis as IORedisClient } from "ioredis";
import { serverEnv, hasCredentials } from "@/lib/env";

let _client: IORedisClient | null = null;

/**
 * Lazy ioredis client. Works with Redis Cloud, Upstash (TCP/TLS), Dragonfly,
 * or self-hosted Redis. URL must include password if auth is required:
 *   redis://default:PASSWORD@host:port
 *   rediss://default:PASSWORD@host:port  (TLS)
 *
 * Returns null when REDIS_URL is absent — callers must guard so the app
 * keeps booting in stubbed mode.
 */
export function redis(): IORedisClient | null {
  if (!hasCredentials.redis()) return null;
  if (_client) return _client;
  const env = serverEnv();
  _client = new IORedis(env.REDIS_URL!, {
    // Vercel Fluid Compute supports persistent connections, but we still want
    // resilient cold-start behavior.
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    connectTimeout: 5_000,
    lazyConnect: false,
  });
  _client.on("error", (err) => {
    console.error("[redis] connection error:", err.message);
  });
  return _client;
}

export class RedisUnavailableError extends Error {
  constructor() {
    super("Redis is not configured. Set REDIS_URL.");
    this.name = "RedisUnavailableError";
  }
}

export function requireRedis(): IORedisClient {
  const r = redis();
  if (!r) throw new RedisUnavailableError();
  return r;
}
