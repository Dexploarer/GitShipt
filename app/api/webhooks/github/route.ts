import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { start } from "workflow/api";
import { dbHttp } from "@/db";
import { webhooksInbox, projects } from "@/db/schema";
import { verifyAndParse } from "@/lib/github/webhook";
import { indexProjectDeltas } from "@/workflows/indexProjectDeltas";

export const dynamic = "force-dynamic";

type GithubPayload = {
  repository?: { id: number; full_name: string };
  installation?: { id: number };
  action?: string;
  pull_request?: { merged?: boolean };
};

/**
 * GitHub webhook receiver. Verifies HMAC, deduplicates on (source, delivery)
 * via `webhooks_inbox`, routes push/PR-merge events to the per-project
 * indexer, and marks the inbox row processed.
 */
export async function POST(req: Request): Promise<Response> {
  const result = await verifyAndParse(req);
  if (!result.ok) {
    if (result.reason === "no_secret") {
      return NextResponse.json({ error: result.reason }, { status: 503 });
    }
    return NextResponse.json({ error: result.reason }, { status: 401 });
  }

  const signature = req.headers.get("x-hub-signature-256");
  const insertResult = await dbHttp
    .insert(webhooksInbox)
    .values({
      source: "github",
      eventId: result.delivery,
      eventType: result.event,
      signature,
      payload: result.payload as Record<string, unknown>,
    })
    .onConflictDoNothing({
      target: [webhooksInbox.source, webhooksInbox.eventId],
    })
    .returning({ id: webhooksInbox.id });

  if (insertResult.length === 0) {
    return NextResponse.json({ ok: true, status: "duplicate" });
  }

  const payload = result.payload as GithubPayload;

  const isPush = result.event === "push";
  const isMergedPR =
    result.event === "pull_request" &&
    payload.action === "closed" &&
    payload.pull_request?.merged === true;

  if ((isPush || isMergedPR) && payload.repository) {
    const repoId = String(payload.repository.id);
    const [proj] = await dbHttp
      .select({ id: projects.id, status: projects.status })
      .from(projects)
      .where(eq(projects.ghRepoId, repoId))
      .limit(1);
    if (proj && proj.status === "live") {
      await start(indexProjectDeltas, [proj.id]);
    }
  }

  // installation event handling deferred (linked at launch wizard time).

  await dbHttp
    .update(webhooksInbox)
    .set({ processedAt: new Date() })
    .where(
      and(
        eq(webhooksInbox.source, "github"),
        eq(webhooksInbox.eventId, result.delivery),
      ),
    );

  return NextResponse.json({ ok: true });
}
