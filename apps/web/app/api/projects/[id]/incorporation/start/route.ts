import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { dbHttp } from "@/db";
import { projects } from "@/db/schema";
import { PermissionError, requirePermission } from "@/lib/auth/permissions";
import { bags } from "@/lib/bags/client";
import { hasCredentials } from "@/lib/env";
import { withIdempotency } from "@/lib/idempotency";
import { revalidateProjectCaches } from "@/lib/cache";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  if (!hasCredentials.db()) {
    return NextResponse.json(
      { error: "db_unavailable", message: "DB not configured." },
      { status: 503 },
    );
  }
  if (!hasCredentials.bags()) {
    return NextResponse.json(
      { error: "bags_unavailable", message: "Bags API key not configured." },
      { status: 503 },
    );
  }

  const { id: projectId } = await ctx.params;
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    await requirePermission("project.update", { userId, projectId });
  } catch (e) {
    if (e instanceof PermissionError) {
      return NextResponse.json(
        { error: "forbidden", message: e.message },
        { status: 403 },
      );
    }
    throw e;
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = req.headers.get("user-agent");
  const idempotencyKey =
    req.headers.get("idempotency-key") ?? `incorporation:start:${projectId}`;

  try {
    const result = await withIdempotency(
      idempotencyKey,
      async () => {
        const [project] = await dbHttp
          .select({
            tokenMint: projects.tokenMint,
            status: projects.status,
            ghOwner: projects.ghOwner,
            ghRepo: projects.ghRepo,
          })
          .from(projects)
          .where(eq(projects.id, projectId))
          .limit(1);

        if (!project?.tokenMint) {
          throw new IncorporationStartError(
            "token_missing",
            "Finish token launch before starting incorporation.",
            409,
          );
        }
        if (project.status !== "live") {
          throw new IncorporationStartError(
            "token_not_live",
            "Only live Bags tokens can start incorporation.",
            409,
          );
        }

        const started = await bags.startIncorporation(project.tokenMint);
        await audit({
          actorUserId: userId,
          action: "project.incorporation_start",
          targetType: "project",
          targetId: projectId,
          metadata: {
            tokenMint: project.tokenMint,
            incorporationStarted: started.incorporationStarted,
          },
          ip,
          userAgent,
        });

        return {
          ok: true,
          tokenAddress: started.tokenAddress,
          incorporationStarted: started.incorporationStarted,
          slug: `${project.ghOwner}/${project.ghRepo}`,
        };
      },
      { scope: `project:incorporation:start:${projectId}` },
    );

    await revalidateProjectCaches(projectId, result.slug);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof IncorporationStartError) {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: e.status },
      );
    }
    const message =
      e instanceof Error ? e.message : "Failed to start incorporation.";
    console.error("[projects:incorporation:start] failed:", e);
    return NextResponse.json(
      { error: "incorporation_start_failed", message },
      { status: 500 },
    );
  }
}

class IncorporationStartError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "IncorporationStartError";
  }
}
