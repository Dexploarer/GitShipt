import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { expireEscrow } from "@/workflows/expireEscrow";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * Daily escrow sweep cron — 01:00 UTC. Triggers `expireEscrow`, which marks
 * holdings whose grace period elapsed.
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const run = await start(expireEscrow, []);
  return NextResponse.json({ ok: true, runId: run.runId });
}
