import "server-only";
import { eq } from "drizzle-orm";
import { sql, type SQL } from "drizzle-orm";
import { dbHttp } from "@/db";
import { users } from "@/db/schema";
import {
  getRlsContext,
  enterRlsContext,
  withRlsContext,
  type RlsContext,
} from "@/db/rls-context";

export { withRlsContext };

export function enterDbAnonymousContext(reason = "anonymous"): void {
  enterRlsContext({ mode: "anon", reason });
}

export function enterDbServiceContext(reason: string): void {
  enterRlsContext({ mode: "service", reason });
}

export function enterDbWorkflowContext(workflowName: string): void {
  enterDbServiceContext(`workflow:${workflowName}`);
}

export function withDbServiceContext<T>(
  reason: string,
  fn: () => Promise<T>,
): Promise<T> {
  return withRlsContext({ mode: "service", reason }, fn);
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
