import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { executePayout } from "@/workflows/executePayout";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * Daily payout cron — 00:30 UTC. Triggers `executePayout`, which fans out
 * a per-snapshot pipeline (claim Bags fees, distribute, escrow leftovers).
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const run = await start(executePayout, []);
  return NextResponse.json({ ok: true, runId: run.runId });
}
