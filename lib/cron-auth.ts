import { serverEnv } from "@/lib/env";

/**
 * Vercel Cron sets `Authorization: Bearer ${CRON_SECRET}` on every cron
 * invocation. Every /api/cron/* handler MUST validate this before running
 * any side-effects.
 *
 * Returns true when the request is authorized to run cron work, false
 * otherwise.
 */
export function isAuthorizedCron(req: Request): boolean {
  const env = serverEnv();
  if (!env.CRON_SECRET) {
    // In dev without CRON_SECRET set, allow on a same-origin request only.
    if (env.NODE_ENV !== "production") {
      const origin = req.headers.get("origin");
      const host = req.headers.get("host");
      if (!origin || origin.includes(host ?? "")) return true;
    }
    return false;
  }
  return req.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}
