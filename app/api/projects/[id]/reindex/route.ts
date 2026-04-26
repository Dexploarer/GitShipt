import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { start } from "workflow/api";
import { auth } from "@/lib/auth";
import {
  hasPermission,
  PermissionError,
  requirePermission,
} from "@/lib/auth/permissions";
import { getProjectRecord } from "@/lib/queries/dashboard";
import { audit } from "@/lib/audit";
import { hasCredentials } from "@/lib/env";
import { indexProjectDeltas } from "@/workflows/indexProjectDeltas";
import { revalidateProjectCaches } from "@/lib/cache";

export const dynamic = "force-dynamic";

/**
 * POST /api/projects/[id]/reindex
 *
 * Manually triggers the per-project GitHub indexer. Owners and super-admins
 * only. The 15-minute cron handles routine catch-up; this is an escape
 * hatch when an owner just installed the App or wants to verify a fix.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!hasCredentials.db()) {
    return NextResponse.json(
      { error: "db_unavailable" },
      { status: 503 },
    );
  }
  const { id: projectId } = await params;

  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const project = await getProjectRecord(projectId);
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const ok = await hasPermission("project.update", {
    userId: session.user.id,
    projectId,
  });
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  try {
    await requirePermission("project.update", {
      userId: session.user.id,
      projectId,
    });
  } catch (e) {
    if (e instanceof PermissionError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    throw e;
  }

  if (!project.ghInstallationId) {
    return NextResponse.json(
      {
        error: "no_installation",
        message:
          "GitHub App not installed for this repo. Install it before re-indexing.",
      },
      { status: 409 },
    );
  }

  let runId: string | null = null;
  try {
    const run = await start(indexProjectDeltas, [projectId]);
    runId = run?.runId ?? null;
  } catch (e) {
    console.error("[projects/reindex] start failed:", e);
    return NextResponse.json(
      { error: "start_failed", message: (e as Error).message },
      { status: 500 },
    );
  }

  await audit({
    actorUserId: session.user.id,
    action: "project.reindex",
    targetType: "project",
    targetId: projectId,
    metadata: { runId, manual: true },
    ip: req.headers.get("x-forwarded-for") ?? null,
    userAgent: req.headers.get("user-agent") ?? null,
  });

  await revalidateProjectCaches(projectId);

  return NextResponse.json({ ok: true, runId }, { status: 202 });
}
