import "server-only";
import type { NeonQueryFunction } from "@neondatabase/serverless";

export type RlsContext =
  | { mode: "anon"; reason?: string }
  | { mode: "user"; userId: string; role: string; reason?: string }
  | { mode: "service"; reason: string };

// Async-context propagation works one of two ways depending on the caller:
//
//   1. Concurrent user requests (auth, route handlers, server actions) need
//      AsyncLocalStorage so simultaneous requests in a Fluid Compute instance
//      don't leak each other's RLS context. Those entries import
//      `@/db/rls-storage-init` at module load (see below) which stashes a
//      real `AsyncLocalStorage` instance under `STORE_KEY` on globalThis.
//      `getRlsContext` reads from that storage when present.
//
//   2. Sequential / single-shot callers (workflow steps, webhooks, cron
//      handlers) don't need cross-async propagation — each runs in its own
//      isolated request/process. Those use the lightweight `_override`
//      mechanism (settable via `enterDbServiceContext` / `enterDbWorkflowContext`
//      in `@/lib/db-rls`) so they never have to import `node:async_hooks`.
//      The Workflow DevKit's build analyzer rejects any reachable static
//      `node:async_hooks` import, so workflow helpers MUST stay on the
//      override path.
//
// Order of resolution in `getRlsContext`: AsyncLocalStorage > override > anon.

const STORE_KEY = Symbol.for("gitshipt.rls-storage");

interface AsyncLocalStorageLike<T> {
  getStore(): T | undefined;
  enterWith(value: T): void;
  run<R>(value: T, fn: () => R): R;
}

function getStorage(): AsyncLocalStorageLike<RlsContext> | null {
  const slot = (
    globalThis as unknown as {
      [k: symbol]: AsyncLocalStorageLike<RlsContext> | undefined;
    }
  )[STORE_KEY];
  return slot ?? null;
}

let _override: RlsContext | null = null;

export function setRlsOverride(ctx: RlsContext | null): void {
  _override = ctx;
}

export function getRlsOverride(): RlsContext | null {
  return _override;
}

export function getRlsContext(): RlsContext {
  const fromStorage = getStorage()?.getStore();
  if (fromStorage) return fromStorage;
  if (_override) return _override;
  return { mode: "anon" };
}

function requireStorage(): AsyncLocalStorageLike<RlsContext> {
  const s = getStorage();
  if (!s) {
    throw new Error(
      "[rls-context] AsyncLocalStorage is not initialized. Import " +
        '"@/db/rls-storage-init" from your entry point (layout, route ' +
        "handler, or auth setup) before calling enterRlsContext / withRlsContext.",
    );
  }
  return s;
}

export function enterRlsContext(ctx: RlsContext): void {
  requireStorage().enterWith(ctx);
}

export function withRlsContext<T>(
  ctx: RlsContext,
  fn: () => Promise<T>,
): Promise<T> {
  return requireStorage().run(ctx, fn) as Promise<T>;
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
