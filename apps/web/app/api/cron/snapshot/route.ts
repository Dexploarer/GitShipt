import { NextResponse } from "next/server";
import { takeSnapshot } from "@/workflows/takeSnapshot";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { safeStartWorkflow } from "@/lib/cron-helpers";

export const maxDuration = 800;

/**
 * Daily snapshot cron — 00:00 UTC. Triggers `takeSnapshot`, which fans out
 * a per-project freeze workflow.
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return safeStartWorkflow(takeSnapshot, [], "snapshot");
}
