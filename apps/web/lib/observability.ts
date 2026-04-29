/**
 * Vendor-neutral observability shim.
 *
 * Default behaviour is structured-JSON-to-stderr so Vercel's log drain
 * captures everything without any external integration. To plug in Sentry,
 * Datadog, Logtail, or @vercel/observability, register an adapter ONCE at
 * boot from `instrumentation.ts`:
 *
 *   import { registerObservabilityAdapter } from "@/lib/observability";
 *   import * as Sentry from "@sentry/nextjs";
 *
 *   export function register() {
 *     Sentry.init({ dsn: process.env.SENTRY_DSN! });
 *     registerObservabilityAdapter({
 *       captureException(err, ctx) {
 *         Sentry.captureException(err, { contexts: { gitshipt: ctx } });
 *       },
 *       captureEvent(message, ctx) {
 *         Sentry.captureMessage(message, {
 *           level: ctx.severity ?? "info",
 *           contexts: { gitshipt: ctx },
 *         });
 *       },
 *     });
 *   }
 *
 * Every existing call site routes through `captureException` /
 * `captureEvent`, so the swap is a single-file change. The default
 * stderr writer continues to fire in addition to the adapter — duplicate
 * output is a feature: log-drain visibility persists even if the
 * vendor SDK breaks at runtime.
 *
 * PII (emails, addresses, signatures) MUST NOT be passed in — callers
 * redact at the source.
 */

export type Severity = "info" | "warning" | "error" | "fatal";

export interface CaptureContext {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  /**
   * Stable identifier for the call site, e.g. "audit.insert", "payout.dispatch".
   * Used by alerting rules to filter by area without parsing the message.
   */
  area?: string;
  /**
   * Optional severity hint. Defaults to "error" for captureException and
   * "info" for captureEvent.
   */
  severity?: Severity;
}

export interface ObservabilityAdapter {
  captureException(err: unknown, ctx: CaptureContext): void;
  captureEvent(message: string, ctx: CaptureContext): void;
}

let adapter: ObservabilityAdapter | null = null;

/**
 * Replace or unset the active vendor adapter. Idempotent — calling twice
 * with the same value is a no-op. Called at most once at boot from
 * `instrumentation.ts`. Pass `null` to revert to the stderr-only default
 * (used in tests so vendor SDKs don't fire).
 */
export function registerObservabilityAdapter(
  next: ObservabilityAdapter | null,
): void {
  adapter = next;
}

function emit(
  type: "exception" | "event",
  payload: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    "@timestamp": new Date().toISOString(),
    type,
    service: "gitshipt",
    ...payload,
  });
  // stderr keeps these out of regular request logs; Vercel's drain captures
  // both streams. Avoid console.log so test runners don't flag them.
  process.stderr.write(line + "\n");
}

export function captureException(
  err: unknown,
  ctx: CaptureContext = {},
): void {
  const e =
    err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : { name: "NonError", message: String(err) };
  emit("exception", {
    severity: ctx.severity ?? "error",
    area: ctx.area ?? "unknown",
    error: e,
    tags: ctx.tags ?? {},
    extra: ctx.extra ?? {},
  });
  if (adapter) {
    try {
      adapter.captureException(err, ctx);
    } catch {
      // Adapter must never break the calling code path. Swallow.
    }
  }
}

export function captureEvent(
  message: string,
  ctx: CaptureContext = {},
): void {
  emit("event", {
    severity: ctx.severity ?? "info",
    area: ctx.area ?? "unknown",
    message,
    tags: ctx.tags ?? {},
    extra: ctx.extra ?? {},
  });
  if (adapter) {
    try {
      adapter.captureEvent(message, ctx);
    } catch {
      // Adapter must never break the calling code path. Swallow.
    }
  }
}
