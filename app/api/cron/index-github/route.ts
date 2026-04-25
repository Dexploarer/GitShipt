import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/**
 * GitHub indexer cron — every 15 minutes.
 * Day 1 stub. Day 2 wires in `indexGithubDeltas` workflow.
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  // TODO(day-2): const run = await start(indexGithubDeltas, [])
  return NextResponse.json({ ok: true, scheduled: "indexGithubDeltas (day-2)" });
}
