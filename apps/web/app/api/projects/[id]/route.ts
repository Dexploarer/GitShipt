import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { dbHttp } from "@/db";
import { projects, projectMemberships, users } from "@/db/schema";
import { hasCredentials } from "@/lib/env";
import { check } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/{id} — read draft state for the wizard's ReviewAndSign step.
 *
 * Auth: caller must be a member of the project (project_owner or
 * project_moderator) OR a global super_admin/admin/moderator.
 */
export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  if (!hasCredentials.db()) {
    return NextResponse.json(
      { error: "db_unavailable", message: "DB not configured." },
      { status: 503 },
    );
  }

  const params = await ctx.params;
  const projectId = params.id;
  if (!projectId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const limit = await check("default", `project-read:${userId ?? ip}`);
  if (!limit.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const [project] = await dbHttp
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Membership check.
  const [membership] = await dbHttp
    .select({ role: projectMemberships.role })
    .from(projectMemberships)
    .where(
      and(
        eq(projectMemberships.userId, userId),
        eq(projectMemberships.projectId, projectId),
      ),
    )
    .limit(1);

  if (!membership) {
    // Maybe a global staff role can still read.
    const [user] = await dbHttp
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const isStaff =
      user?.role === "moderator" ||
      user?.role === "admin" ||
      user?.role === "super_admin";
    if (!isStaff) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json({
    id: project.id,
    ghOwner: project.ghOwner,
    ghRepo: project.ghRepo,
    ghRepoId: project.ghRepoId,
    ghInstallationId: project.ghInstallationId,
    name: project.name,
    description: project.description,
    imageUrl: project.imageUrl,
    tokenMint: project.tokenMint,
    bagsLaunchId: project.bagsLaunchId,
    bagsConfigKey: project.bagsConfigKey,
    status: project.status,
    platformFeeBps: project.platformFeeBps,
    scoringConfig: project.scoringConfig,
    payoutConfig: project.payoutConfig,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  });
}
