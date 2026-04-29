import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { captureException } from "@/lib/observability";
import { noStoreJson, privateNoStoreJson } from "@/lib/no-store-response";
import { serverEnv } from "@/lib/env";

/**
 * Central API response helpers.
 *
 * Goals:
 *  - Uniform error shape: `{ error: <code>, message?, details? }`.
 *  - `Cache-Control: no-store` on every response (mutations and reads alike).
 *  - 5xx bodies never leak stack traces or internal env values to clients.
 *  - Zod validation errors are normalized to `error: "invalid_body"` with
 *    a flattened issues map, so callers don't have to remember the shape.
 *
 * Usage from a route handler:
 *
 *     return apiOk({ ok: true, project });
 *     return apiError(403, "forbidden", "You don't own this project.");
 *     return apiInvalidBody(parsed.error);
 *     return apiInternal(err, { area: "projects.create" });
 */

export interface ApiErrorBody {
  error: string;
  message?: string;
  details?: unknown;
}

export function apiOk<T>(body: T, init: ResponseInit = {}): NextResponse {
  return noStoreJson(body, init);
}

/**
 * Like apiOk but explicitly marks the response Cache-Control: private,no-store.
 * Use for any payload that includes user-scoped data (sessions, balances,
 * private project state).
 */
export function apiOkPrivate<T>(
  body: T,
  init: ResponseInit = {},
): NextResponse {
  return privateNoStoreJson(body, init);
}

export function apiError(
  status: number,
  code: string,
  message?: string,
  details?: unknown,
  init: ResponseInit = {},
): NextResponse {
  const body: ApiErrorBody = { error: code };
  if (message) body.message = message;
  if (details !== undefined) body.details = details;
  return noStoreJson(body, { ...init, status });
}

export function apiInvalidBody(
  err: ZodError,
  message = "Invalid request body.",
): NextResponse {
  return apiError(400, "invalid_body", message, err.flatten());
}

/**
 * 5xx response that captures the underlying exception to the observability
 * sink, redacts internal detail from the client body, and only surfaces a
 * stable error code. The full error and stack stay server-side.
 */
export function apiInternal(
  err: unknown,
  ctx: { area?: string; tags?: Record<string, string> } = {},
): NextResponse {
  captureException(err, {
    area: ctx.area ?? "api.internal",
    severity: "error",
    tags: ctx.tags,
  });
  const isProd = serverEnv().NODE_ENV === "production";
  return apiError(
    500,
    "internal_error",
    isProd
      ? "Something went wrong. The error has been logged."
      : err instanceof Error
        ? err.message
        : String(err),
  );
}
