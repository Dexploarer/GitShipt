import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { NeonQueryFunction } from "@neondatabase/serverless";

export type RlsContext =
  | { mode: "anon"; reason?: string }
  | { mode: "user"; userId: string; role: string; reason?: string }
  | { mode: "service"; reason: string };

const storage = new AsyncLocalStorage<RlsContext>();

export function getRlsContext(): RlsContext {
  return storage.getStore() ?? { mode: "anon" };
}

export function enterRlsContext(ctx: RlsContext): void {
  storage.enterWith(ctx);
}

export function withRlsContext<T>(
  ctx: RlsContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(ctx, fn);
}

/**
 * Wrap Neon HTTP queries in a short transaction that first sets the local RLS
 * GUCs consumed by Postgres policies. Drizzle still sees only the actual query
 * result. No context defaults to anon, so accidental private reads fail closed.
 */
export function createRlsNeonClient(
  base: NeonQueryFunction<false, false>,
): NeonQueryFunction<false, false> {
  const wrapped = ((
    queryOrStrings: string | TemplateStringsArray,
    ...args: unknown[]
  ) => {
    if (typeof queryOrStrings !== "string") {
      return base(queryOrStrings, ...args);
    }

    const query = queryOrStrings;
    const params = (Array.isArray(args[0]) ? args[0] : []) as unknown[];
    const opts = args[1] as Parameters<typeof base>[2];
    const ctx = getRlsContext();
    const userId = ctx.mode === "user" ? ctx.userId : "";
    const role = ctx.mode === "user" ? ctx.role : "";
    const reason = ctx.reason ?? "";

    const promise = base
      .transaction(
        (sql) => [
          sql(
            "select set_config('app.rls_mode', $1, true), set_config('app.user_id', $2, true), set_config('app.role', $3, true), set_config('app.rls_reason', $4, true)",
            [ctx.mode, userId, role, reason],
          ),
          sql(query, params),
        ],
        opts,
      )
      .then((results) => results[1]);

    Object.assign(promise, {
      parameterizedQuery: { query, params },
      opts,
    });
    return promise;
  }) as NeonQueryFunction<false, false>;

  wrapped.transaction = ((queriesOrFn, opts) => {
    const ctx = getRlsContext();
    const userId = ctx.mode === "user" ? ctx.userId : "";
    const role = ctx.mode === "user" ? ctx.role : "";
    const reason = ctx.reason ?? "";
    return base.transaction(
      (sql) => [
        sql(
          "select set_config('app.rls_mode', $1, true), set_config('app.user_id', $2, true), set_config('app.role', $3, true), set_config('app.rls_reason', $4, true)",
          [ctx.mode, userId, role, reason],
        ),
        ...(typeof queriesOrFn === "function" ? queriesOrFn(sql) : queriesOrFn),
      ],
      opts,
    );
  }) as NeonQueryFunction<false, false>["transaction"];

  return wrapped;
}

export function pgServiceOptions(): string {
  return "-c app.rls_mode=service -c app.rls_reason=pool";
}
