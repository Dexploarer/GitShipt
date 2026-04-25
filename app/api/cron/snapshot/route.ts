import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Daily snapshot cron — 00:00 UTC.
 * Day 1 stub. Day 3 wires in `takeSnapshot` workflow.
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  // TODO(day-3): const run = await start(takeSnapshot, [])
  return NextResponse.json({ ok: true, scheduled: "takeSnapshot (day-3)" });
}
