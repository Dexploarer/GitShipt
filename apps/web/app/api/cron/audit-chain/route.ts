import { NextResponse } from "next/server";

import { isAuthorizedCron } from "@/lib/cron-auth";
import { runAuditChainVerification } from "@/lib/audit-chain";

export const maxDuration = 800;

/**
 * Audit-chain verification cron. Re-walks the audit log hash chain end-to-end,
 * compares every row's stored prev_hash and entry_hash against the value
 * implied by canonical(prev || row), and emits a structured event.
 *
 * Any break is fatal severity to observability — a tamper / replication /
 * canonical-fn divergence event is the kind of thing on-call should be paged
 * for. The HTTP response is 200 either way so cron retry semantics don't fire
 * on a deliberately-detected break; the alerting rule on the observability
 * sink owns the page.
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const result = await runAuditChainVerification();
  return NextResponse.json({
    ok: result.ok,
    rowsChecked: result.rowsChecked,
    breakCount: result.breaks.length,
  });
}
