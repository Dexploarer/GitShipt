import { NextResponse } from "next/server";
import { expireEscrow } from "@/workflows/expireEscrow";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { safeStartWorkflow } from "@/lib/cron-helpers";

export const maxDuration = 800;

/**
 * Daily escrow sweep cron — 01:00 UTC. Triggers `expireEscrow`, which marks
 * holdings whose grace period elapsed.
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return safeStartWorkflow(expireEscrow, [], "expire-escrow");
}
