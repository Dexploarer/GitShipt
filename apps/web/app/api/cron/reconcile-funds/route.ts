import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { safeStartWorkflow } from "@/lib/cron-helpers";
import { reconcileFunds } from "@/workflows/reconcileFunds";

export const maxDuration = 800;

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return safeStartWorkflow(reconcileFunds, [], "reconcile-funds");
}
