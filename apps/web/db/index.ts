import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { neon, Pool } from "@neondatabase/serverless";
import postgres from "postgres";
import { databaseUrl, databaseUrlUnpooled, serverEnv } from "@/lib/env";
import * as schema from "./schema";
import { createRlsNeonClient, pgServiceOptions } from "./rls-context";

type DbHttp = ReturnType<typeof drizzleHttp<typeof schema>>;
type DbPool = ReturnType<typeof drizzleServerless<typeof schema>>;

/**
 * Neon's serverless drivers (`neon-http`, `neon-serverless`) only speak Neon's
 * protocol. Supabase/Vercel Marketplace and generic Postgres use postgres-js.
 * Those server connections are privileged application connections; RLS is a
 * defense-in-depth layer and route/server-action authorization remains the
 * primary boundary.
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
    "[db] Supabase/generic Postgres connection detected — using postgres-js with app-level authorization.",
  );
}

/**
 * Production guard: a non-Neon DATABASE_URL silently disables RLS, leaving
 * `requirePermission` as the sole authorization boundary. That is acceptable
 * if explicitly opted in via ALLOW_NON_NEON_RLS_OFF=true; otherwise we refuse
 * to wire the client and force the operator to make the choice consciously.
 */
function ensureRlsBoundaryAllowed(url: string): void {
  if (isNeonUrl(url)) return;
  const env = serverEnv();
  if (env.NODE_ENV !== "production") return;
  if (env.ALLOW_NON_NEON_RLS_OFF) {
    warnNonNeonRlsOnce();
    return;
  }
  throw new Error(
    "[db] DATABASE_URL points at a non-Neon host but RLS is required in production. " +
      "Set ALLOW_NON_NEON_RLS_OFF=true only with a documented mitigation plan.",
  );
}

const httpUrl = databaseUrl();

export const dbHttp: DbHttp = httpUrl
  ? isNeonUrl(httpUrl)
    ? drizzleHttp(createRlsNeonClient(neon(httpUrl)), { schema })
    : ((): DbHttp => {
        ensureRlsBoundaryAllowed(httpUrl);
        warnNonNeonRlsOnce();
        // Cap connections so dev hot-reloads + parallel requests stay
        // under Supabase's session-pooler limit (free tier: 15).
        return drizzlePg(postgres(httpUrl, { prepare: false, max: 5 }), {
          schema,
        }) as unknown as DbHttp;
      })()
  : (new Proxy({} as DbHttp, {
      get() {
        throw new Error(
          "DATABASE_URL or POSTGRES_URL is not configured. Provision Supabase via Vercel Marketplace, or set a Postgres connection string.",
        );
      },
    }) as DbHttp);

let _dbPool: DbPool | null = null;

export function dbPool(): DbPool {
  if (_dbPool) return _dbPool;
  const connectionString = databaseUrlUnpooled();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL_UNPOOLED, POSTGRES_URL_NON_POOLING, DATABASE_URL, or POSTGRES_URL is not configured.",
    );
  }
  if (isNeonUrl(connectionString)) {
    const pool = new Pool({
      connectionString,
      options: pgServiceOptions(),
    });
    _dbPool = drizzleServerless(pool, { schema });
  } else {
    ensureRlsBoundaryAllowed(connectionString);
    warnNonNeonRlsOnce();
    // Cap to stay under Supabase's session-pooler limit (free tier: 15
    // concurrent clients). dbPool serves multi-statement transactions
    // and is hit harder than dbHttp; cap is intentionally generous but
    // bounded so hot-reload churn doesn't exhaust the pooler.
    const sql = postgres(connectionString, { max: 5 });
    _dbPool = drizzlePg(sql, { schema }) as unknown as DbPool;
  }
  return _dbPool;
}

export { schema };
