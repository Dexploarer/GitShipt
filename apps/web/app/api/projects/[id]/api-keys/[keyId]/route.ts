import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  hasPermission,
  PermissionError,
  requirePermission,
} from "@/lib/auth/permissions";
import { getProjectRecord } from "@/lib/queries/dashboard";
import { audit } from "@/lib/audit";
import { hasCredentials } from "@/lib/env";
import { revokeApiKey } from "@/lib/queries/api-keys";
import { withIdempotency } from "@/lib/idempotency";
import { revalidateProjectCaches } from "@/lib/cache";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/projects/[id]/api-keys/[keyId]
 *
 * Soft-revokes an API key (sets `revoked_at`). Owner-or-super-admin scoped.
 * Idempotent — if the key is already revoked we return 200 with `revoked: false`.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; keyId: string }> },
): Promise<Response> {
  if (!hasCredentials.db()) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }
  const { id: projectId, keyId } = await params;

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

  const idempotencyKey =
    req.headers.get("idempotency-key") ??
    req.headers.get("Idempotency-Key") ??
    `api-key:revoke:${projectId}:${keyId}:${session.user.id}`;

  const result = await withIdempotency(
    idempotencyKey,
    async () => {
      const revoked = await revokeApiKey(keyId, session.user.id);

      // 404 only when the key doesn't belong to this project (defense in depth).
      if (revoked.projectId && revoked.projectId !== projectId) {
        return { notFound: true as const, revoked };
      }

      if (revoked.revoked) {
        await audit({
          actorUserId: session.user.id,
          action: "project.api_key_revoke",
          targetType: "api_key",
          targetId: keyId,
          metadata: { projectId },
          ip: req.headers.get("x-forwarded-for") ?? null,
          userAgent: req.headers.get("user-agent") ?? null,
        });
      }

      return { notFound: false as const, revoked };
    },
    { scope: `api-key:revoke:${projectId}:${session.user.id}` },
  );

  if (result.notFound) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (result.revoked.revoked) {
    await revalidateProjectCaches(projectId);
  }

  return NextResponse.json(
    { ok: true, revoked: result.revoked.revoked },
    { status: 200 },
  );
}
