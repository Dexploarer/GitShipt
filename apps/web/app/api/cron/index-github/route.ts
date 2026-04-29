import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { safeStartWorkflow } from "@/lib/cron-helpers";
import { indexGithubDeltas } from "@/workflows/indexGithubDeltas";

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
  return safeStartWorkflow(indexGithubDeltas, [], "index-github");
}
