import "server-only";
import { eq } from "drizzle-orm";
import { sql, type SQL } from "drizzle-orm";
import { dbHttp } from "@/db";
import { users } from "@/db/schema";
import {
  getRlsContext,
  getRlsOverride,
  setRlsOverride,
  enterRlsContext,
  withRlsContext,
  type RlsContext,
} from "@/db/rls-context";

export { withRlsContext };

// The "enter" / "with" service- and anon-mode helpers use the lightweight
// override path on `db/rls-context.ts` instead of AsyncLocalStorage. This
// keeps the call graph free of `node:async_hooks` so workflow step helpers
// (which import this module to call `enterDbWorkflowContext`) compile cleanly
// under the Workflow DevKit's analyzer. User-mode callers still go through
// AsyncLocalStorage via `establishDbUserContext` below — that path requires
// `@/db/rls-storage-init` to be loaded by the entry point.

export function enterDbAnonymousContext(reason = "anonymous"): void {
  setRlsOverride({ mode: "anon", reason });
}

export function enterDbServiceContext(reason: string): void {
  setRlsOverride({ mode: "service", reason });
}

export function enterDbWorkflowContext(workflowName: string): void {
  enterDbServiceContext(`workflow:${workflowName}`);
}

export async function withDbServiceContext<T>(
  reason: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = getRlsOverride();
  setRlsOverride({ mode: "service", reason });
  try {
    return await fn();
  } finally {
    setRlsOverride(prev);
  }
}

interface RlsExecutable {
  execute(query: SQL): Promise<unknown>;
}

export async function applyDbRlsContext(
  tx: RlsExecutable,
  override?: RlsContext,
): Promise<void> {
  const ctx = override ?? getRlsContext();
  const userId = ctx.mode === "user" ? ctx.userId : "";
  const role = ctx.mode === "user" ? ctx.role : "";
  const reason = ctx.reason ?? "";
  await tx.execute(sql`
    select
      set_config('app.rls_mode', ${ctx.mode}, true),
      set_config('app.user_id', ${userId}, true),
      set_config('app.role', ${role}, true),
      set_config('app.rls_reason', ${reason}, true)
  `);
}

// User-mode context propagation across concurrent requests requires real
// AsyncLocalStorage. Callers must ensure `@/db/rls-storage-init` has been
// loaded — `lib/auth/index.ts` does this on import.
export async function establishDbUserContext(
  userId: string,
  reason = "session",
): Promise<RlsContext> {
  const [row] = await withDbServiceContext(`resolve-user-role:${reason}`, () =>
    dbHttp
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  );
  const ctx: RlsContext = {
    mode: "user",
    userId,
    role: row?.role ?? "user",
    reason,
  };
  enterRlsContext(ctx);
  return ctx;
}
