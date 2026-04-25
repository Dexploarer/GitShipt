import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import { neon } from "@neondatabase/serverless";
import { Pool } from "@neondatabase/serverless";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

/**
 * HTTP driver — single-shot serverless queries. Use for:
 *  - Workflow steps
 *  - RSC reads
 *  - Server Actions that don't span multiple statements
 *
 * Faster cold-start (no WS handshake), but cannot do `BEGIN/COMMIT`.
 */
const httpEnv = serverEnv();
const httpClient = httpEnv.DATABASE_URL ? neon(httpEnv.DATABASE_URL) : null;
export const dbHttp = httpClient
  ? drizzleHttp(httpClient, { schema })
  : (new Proxy({} as ReturnType<typeof drizzleHttp<typeof schema>>, {
      get() {
        throw new Error(
          "DATABASE_URL is not configured. Provision Neon Postgres via Vercel Marketplace.",
        );
      },
    }) as ReturnType<typeof drizzleHttp<typeof schema>>);

/**
 * Pool driver (WebSocket) — multi-statement transactions. Use for:
 *  - SIWS verify + insert (atomic)
 *  - Project launch (project + scoring + payout config in one tx)
 *  - Snapshot freeze (snapshot row + status update)
 *
 * Slightly higher latency; only use when you actually need transactions.
 */
let _dbPool: ReturnType<typeof drizzleServerless<typeof schema>> | null = null;

export function dbPool(): ReturnType<typeof drizzleServerless<typeof schema>> {
  if (_dbPool) return _dbPool;
  const env = serverEnv();
  const connectionString = env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL_UNPOOLED (or DATABASE_URL) is not configured. Provision Neon Postgres.",
    );
  }
  const pool = new Pool({ connectionString });
  _dbPool = drizzleServerless(pool, { schema });
  return _dbPool;
}

export { schema };
