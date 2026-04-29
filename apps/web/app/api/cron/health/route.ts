import { NextResponse } from "next/server";
import { healthPulse } from "@/workflows/healthPulse";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { safeStartWorkflow } from "@/lib/cron-helpers";

export const maxDuration = 800;

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return safeStartWorkflow(healthPulse, [], "health");
}
