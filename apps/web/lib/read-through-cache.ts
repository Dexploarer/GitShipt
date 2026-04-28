import { redis } from "@/lib/redis";
import type { Redis as IORedisClient } from "ioredis";

type CachePayload =
  | null
  | boolean
  | number
  | string
  | CachePayload[]
  | { [key: string]: CachePayload };

const CACHE_TYPE_KEY = "__gitbags_cache_type";
const CACHE_VALUE_KEY = "value";

export interface ReadThroughCacheOptions<T> {
  key: string;
  ttlSeconds: number;
  loader: () => Promise<T>;
  allowStaleOnError?: boolean;
}

export async function readThroughCache<T>(
  options: ReadThroughCacheOptions<T>,
): Promise<T> {
  const r = safeRedis();
  if (!r) return options.loader();

  const cacheKey = `gitbags:read-through:${options.key}`;
  const cached = await r.get(cacheKey);
  if (cached) {
    try {
      return fromCachePayload<T>(JSON.parse(cached) as CachePayload);
    } catch {
      // Corrupt cache entry. Fall through and refresh it.
    }
  }

  try {
    const value = await options.loader();
    await r.set(
      cacheKey,
      JSON.stringify(toCachePayload(value)),
      "EX",
      Math.max(1, options.ttlSeconds),
    );
    return value;
  } catch (error) {
    if (options.allowStaleOnError && cached) {
      return fromCachePayload<T>(JSON.parse(cached) as CachePayload);
    }
    throw error;
  }
}

export async function getReadThroughPayload<T>(
  key: string,
): Promise<T | null> {
  const r = safeRedis();
  if (!r) return null;
  const cached = await r.get(`gitbags:read-through:${key}`);
  if (!cached) return null;
  return fromCachePayload<T>(JSON.parse(cached) as CachePayload);
}

export async function setReadThroughPayload<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  const r = safeRedis();
  if (!r) return;
  await r.set(
    `gitbags:read-through:${key}`,
    JSON.stringify(toCachePayload(value)),
    "EX",
    Math.max(1, ttlSeconds),
  );
}

function safeRedis(): IORedisClient | null {
  try {
    return redis();
  } catch (error) {
    if (process.env.NODE_ENV === "test") return null;
    throw error;
  }
}

function toCachePayload(value: unknown): CachePayload {
  if (value == null) return null;
  if (typeof value === "bigint") {
    return {
      [CACHE_TYPE_KEY]: "bigint",
      [CACHE_VALUE_KEY]: value.toString(),
    };
  }
  if (value instanceof Date) {
    return {
      [CACHE_TYPE_KEY]: "date",
      [CACHE_VALUE_KEY]: value.toISOString(),
    };
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toCachePayload(item));
  }
  if (typeof value === "object") {
    const out: { [key: string]: CachePayload } = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      out[key] = toCachePayload(item);
    }
    return out;
  }
  throw new TypeError(`Unsupported cache payload value: ${typeof value}`);
}

function fromCachePayload<T>(payload: CachePayload): T {
  return reviveCachePayload(payload) as T;
}

function reviveCachePayload(payload: CachePayload): unknown {
  if (payload == null) return null;
  if (Array.isArray(payload)) {
    return payload.map((item) => reviveCachePayload(item));
  }
  if (typeof payload !== "object") return payload;

  const type = payload[CACHE_TYPE_KEY];
  const value = payload[CACHE_VALUE_KEY];
  if (type === "bigint" && typeof value === "string") return BigInt(value);
  if (type === "date" && typeof value === "string") return new Date(value);

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(payload)) {
    out[key] = reviveCachePayload(item);
  }
  return out;
}
