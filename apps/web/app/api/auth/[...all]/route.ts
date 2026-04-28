import { NextResponse } from "next/server";
import { hasCredentials } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * better-auth catch-all handler. Constructed lazily so the build can succeed
 * without a Postgres URL configured. When credentials are missing, all auth
 * routes return 503 with a hint to provision Postgres.
 */
async function getHandler() {
  if (!hasCredentials.db()) {
    const respond = () =>
      NextResponse.json(
        {
          error: "auth_unavailable",
          message: "Auth requires Postgres. Set DATABASE_URL or POSTGRES_URL.",
        },
        { status: 503 },
      );
    return { GET: respond, POST: respond };
  }
  const [{ auth }, { toNextJsHandler }] = await Promise.all([
    import("@/lib/auth"),
    import("better-auth/next-js"),
  ]);
  return toNextJsHandler(auth());
}

export async function GET(req: Request): Promise<Response> {
  const h = await getHandler();
  return h.GET(req);
}

export async function POST(req: Request): Promise<Response> {
  const h = await getHandler();
  return h.POST(req);
}
