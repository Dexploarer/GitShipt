import IORedis, {
  type Redis as IORedisClient,
  type RedisOptions,
} from "ioredis";
import { hasCredentials, redisUrl } from "@/lib/env";

let _client: IORedisClient | null = null;

export function redisOptionsFromUrl(redisUrl: string): RedisOptions {
  const parsed = new URL(redisUrl);
  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
    throw new Error("REDIS_URL must use redis:// or rediss://.");
  }

  const host = parsed.hostname.startsWith("[")
    ? parsed.hostname.slice(1, -1)
    : parsed.hostname;
  const options: RedisOptions = {
    host,
  };

  if (parsed.port) {
    const port = Number.parseInt(parsed.port, 10);
    if (Number.isNaN(port)) throw new Error("REDIS_URL port is invalid.");
    options.port = port;
  }

  if (parsed.username) {
    options.username = decodeURIComponent(parsed.username);
  }
  if (parsed.password) {
    options.password = decodeURIComponent(parsed.password);
  }

  const db = parsed.pathname.replace(/^\/+/, "");
  if (db) {
    const dbIndex = Number.parseInt(db, 10);
    if (Number.isNaN(dbIndex)) throw new Error("REDIS_URL db is invalid.");
    options.db = dbIndex;
  }

  const family = parsed.searchParams.get("family");
  if (family) {
    const familyValue = Number.parseInt(family, 10);
    if (!Number.isNaN(familyValue)) options.family = familyValue;
  }

  const connectionName = parsed.searchParams.get("connectionName");
  if (connectionName) {
    options.connectionName = connectionName;
  }

  if (parsed.protocol === "rediss:") {
    options.tls = {};
  }

  return options;
}

/**
 * Lazy ioredis client. Works with Redis Cloud, Upstash (TCP/TLS), Dragonfly,
 * or self-hosted Redis. URL must include password if auth is required:
 *   redis://default:PASSWORD@host:port
 *   rediss://default:PASSWORD@host:port  (TLS)
 *
 * Returns null when no Redis URL is configured — callers must guard so the
 * app keeps booting in stubbed mode.
 */
export function redis(): IORedisClient | null {
  if (!hasCredentials.redis()) return null;
  if (_client) return _client;
  const url = redisUrl();
  if (!url) return null;
  _client = new IORedis({
    ...redisOptionsFromUrl(url),
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
