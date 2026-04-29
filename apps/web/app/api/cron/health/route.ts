import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { healthPulse } from "@/workflows/healthPulse";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const maxDuration = 800;

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const run = await start(healthPulse, []);
  return NextResponse.json({ ok: true, runId: run.runId });
}
