import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { RlsContext } from "./rls-context";

// Side-effecting module: import this once from any entry point that needs
// AsyncLocalStorage-based RLS context propagation across concurrent async
// boundaries. After this loads, `db/rls-context.ts`'s `getRlsContext`
// reads from the registered storage automatically.
//
// Workflow step helpers MUST NOT import this file — the static
// `node:async_hooks` import would be reachable from workflow context and
// the Workflow DevKit build analyzer rejects it. Helpers use the override
// path on `db/rls-context.ts` instead (set via
// `enterDbWorkflowContext` / `enterDbServiceContext` in `@/lib/db-rls`).

const STORE_KEY = Symbol.for("gitshipt.rls-storage");

const slot = globalThis as unknown as {
  [k: symbol]: AsyncLocalStorage<RlsContext> | undefined;
};

if (!slot[STORE_KEY]) {
  slot[STORE_KEY] = new AsyncLocalStorage<RlsContext>();
}
