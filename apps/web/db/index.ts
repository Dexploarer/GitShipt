import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { neon, Pool } from "@neondatabase/serverless";
import postgres from "postgres";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";
import { createRlsNeonClient, pgServiceOptions } from "./rls-context";

type DbHttp = ReturnType<typeof drizzleHttp<typeof schema>>;
type DbPool = ReturnType<typeof drizzleServerless<typeof schema>>;

/**
 * Neon's serverless drivers (`neon-http`, `neon-serverless`) only speak Neon's
 * protocol. For any other Postgres host (Supabase pooler, local Postgres,
 * etc.) we fall back to `drizzle-orm/postgres-js`. RLS context wrapping is
 * Neon-only — non-Neon paths rely on `requirePermission` checks alone.
 */
function isNeonUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

let warnedNonNeonRls = false;
function warnNonNeonRlsOnce(): void {
  if (warnedNonNeonRls) return;
  warnedNonNeonRls = true;
  console.warn(
    "[db] Non-Neon DATABASE_URL detected — RLS context wrapping is disabled; relying on requirePermission for authorization.",
  );
}

const httpEnv = serverEnv();
const httpUrl = httpEnv.DATABASE_URL;

export const dbHttp: DbHttp = httpUrl
  ? isNeonUrl(httpUrl)
    ? drizzleHttp(createRlsNeonClient(neon(httpUrl)), { schema })
    : ((): DbHttp => {
        warnNonNeonRlsOnce();
        return drizzlePg(postgres(httpUrl, { prepare: false }), {
          schema,
        }) as unknown as DbHttp;
      })()
  : (new Proxy({} as DbHttp, {
      get() {
        throw new Error(
          "DATABASE_URL is not configured. Provision Neon Postgres via Vercel Marketplace, or set DATABASE_URL to any Postgres connection string.",
        );
      },
    }) as DbHttp);

let _dbPool: DbPool | null = null;

export function dbPool(): DbPool {
  if (_dbPool) return _dbPool;
  const env = serverEnv();
  const connectionString = env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL_UNPOOLED (or DATABASE_URL) is not configured.",
    );
  }
  if (isNeonUrl(connectionString)) {
    const pool = new Pool({
      connectionString,
      options: pgServiceOptions(),
    });
    _dbPool = drizzleServerless(pool, { schema });
  } else {
    warnNonNeonRlsOnce();
    const sql = postgres(connectionString);
    _dbPool = drizzlePg(sql, { schema }) as unknown as DbPool;
  }
  return _dbPool;
}

export { schema };
