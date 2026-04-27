import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { indexGithubDeltas } from "@/workflows/indexGithubDeltas";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * GitHub indexer cron — every 15 minutes per vercel.json. Spawns the
 * fan-out workflow which loads live projects and triggers per-project
 * delta workflows.
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const run = await start(indexGithubDeltas, []);
  return NextResponse.json({ ok: true, runId: run.runId });
}
