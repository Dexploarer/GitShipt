import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Daily payout cron — 00:30 UTC.
 * Day 1 stub. Day 3 wires in `executePayout` workflow.
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  // TODO(day-3): const run = await start(executePayout, [])
  return NextResponse.json({ ok: true, scheduled: "executePayout (day-3)" });
}
