import "server-only";
import { NextResponse } from "next/server";
import { hasCredentials } from "@/lib/env";
import { getProjectRecord } from "@/lib/queries/dashboard";
import { getProjectLeaderboard } from "@/lib/queries/project-page";
import { ProjectLeaderboardResponseSchema } from "@repo/shared";

export const dynamic = "force-dynamic";

/**
 * Public leaderboard API for embeds, docs, and partner integrations.
 * Returns the same ranked rows rendered on `/r/[org]/[repo]`.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!hasCredentials.db()) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const { id } = await params;
  const project = await getProjectRecord(id);
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const leaderboard = await getProjectLeaderboard(id, project.payoutConfig);
  const payload = ProjectLeaderboardResponseSchema.parse({
    projectId: id,
    slug: project.slug,
    generatedAt: new Date().toISOString(),
    leaderboard,
  });

  return NextResponse.json(payload);
}
