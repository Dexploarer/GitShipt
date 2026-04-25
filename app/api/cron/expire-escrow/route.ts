import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Daily escrow sweep cron — 01:00 UTC.
 * Day 1 stub. Day 3 wires in `expireEscrow` workflow.
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  // TODO(day-3): const run = await start(expireEscrow, [])
  return NextResponse.json({ ok: true, scheduled: "expireEscrow (day-3)" });
}
