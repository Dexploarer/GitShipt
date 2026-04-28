import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { dbHttp } from "@/db";
import { projects } from "@/db/schema";
import {
  hasPermission,
  requirePermission,
  PermissionError,
} from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { hasCredentials, serverEnv } from "@/lib/env";
import { promoteProjectFromStub } from "@/lib/queries/admin";
import { withIdempotency } from "@/lib/idempotency";
import { revalidateProjectCaches } from "@/lib/cache";

export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    projectId: z.string().optional(),
    slug: z
      .string()
      .regex(/^[^/]+\/[^/]+$/, "slug must be 'owner/repo'")
      .optional(),
  })
  .refine((b) => Boolean(b.projectId || b.slug), {
    message: "Either projectId or slug is required",
  });

/**
 * POST /api/admin/promote-from-stub
 *
 * Promote a project that was launched in stub mode (`status = 'simulated_live'`)
 * back to `'draft'` so a real on-chain launch can run. Clears tokenMint /
 * bagsLaunchId / bagsConfigKey / simulated_at and deletes every `simulated`
 * payouts row for the project (cascade clears payout_recipients).
 *
 * Auth modes:
 *   - Authenticated user with `admin.access` permission, OR
 *   - `Authorization: Bearer ${CRON_SECRET}` header.
 *
 * Body: { projectId } OR { slug: "owner/repo" }.
 */
export async function POST(req: Request): Promise<Response> {
  if (!hasCredentials.db()) {
    return NextResponse.json(
      { error: "db_unavailable", message: "DB not configured." },
      { status: 503 },
    );
  }

  const env = serverEnv();
  const authHeader = req.headers.get("authorization") ?? "";
  const cronToken = env.CRON_SECRET
    ? authHeader === `Bearer ${env.CRON_SECRET}`
    : false;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = req.headers.get("user-agent");

  let actorUserId: string | null = null;
  if (!cronToken) {
    try {
      const session = await auth().api.getSession({ headers: await headers() });
      if (!session?.user) {
        return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      }
      const ok = await hasPermission("admin.access", {
        userId: session.user.id,
      });
      if (!ok) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      try {
        await requirePermission("admin.access", { userId: session.user.id });
      } catch (e) {
        if (e instanceof PermissionError) {
          return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }
        throw e;
      }
      actorUserId = session.user.id;
    } catch {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "invalid_body", details: (e as Error).message },
      { status: 400 },
    );
  }

  // Resolve slug -> projectId.
  let projectId = body.projectId;
  if (!projectId && body.slug) {
    const [owner, repo] = body.slug.split("/");
    if (!owner || !repo) {
      return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
    }
    const [p] = await dbHttp
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.ghOwner, owner), eq(projects.ghRepo, repo)))
      .limit(1);
    if (!p) {
      return NextResponse.json({ error: "project_not_found" }, { status: 404 });
    }
    projectId = p.id;
  }

  if (!projectId) {
    return NextResponse.json({ error: "missing_project" }, { status: 400 });
  }

  try {
    const idemKey =
      req.headers.get("idempotency-key") ??
      `promote-from-stub:${projectId}:${actorUserId ?? "cron"}`;

    const result = await withIdempotency(
      idemKey,
      async () => {
        const promoted = await promoteProjectFromStub(projectId);

        await audit({
          actorUserId,
          action: "project.launch_promote",
          targetType: "project",
          targetId: projectId,
          metadata: {
            slug: promoted.slug,
            simulatedPayoutsDeleted: promoted.simulatedPayoutsDeleted,
            cronTriggered: cronToken,
          },
          ip,
          userAgent,
        });

        return promoted;
      },
      { scope: `admin:promote-from-stub:${projectId}` },
    );

    await revalidateProjectCaches(result.projectId, result.slug);

    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    console.error("[admin/promote-from-stub] failed:", e);
    return NextResponse.json(
      { error: "promote_failed", message: (e as Error).message },
      { status: 500 },
    );
  }
}
