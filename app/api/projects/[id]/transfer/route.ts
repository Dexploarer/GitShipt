import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { eq, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { dbHttp } from "@/db";
import { projects, users } from "@/db/schema";
import {
  requirePermission,
  PermissionError,
} from "@/lib/auth/permissions";
import {
  destructiveAction,
  DestructiveActionError,
  MfaRequiredError,
} from "@/lib/auth/destructive-action";
import { audit } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import { hasCredentials } from "@/lib/env";
import { transferProjectOwnership } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Body for POST /api/projects/{id}/transfer.
 *
 * Project IDs in this codebase are cuids (see `lib/ids`), not uuids — so we
 * accept a non-empty string instead of `z.string().uuid()`. The recipient
 * resolver below allows the operator to identify the new owner by either a
 * stable user id, an email, or a GitHub username; the strictest match wins.
 */
const BodySchema = z
  .object({
    /** New owner — by stable user id. Optional alternative to lookup string. */
    newOwnerUserId: z.string().min(1).optional(),
    /**
     * Free-form recipient lookup: email or GitHub username. Resolved on the
     * server to a single user row; ambiguous matches reject.
     */
    recipientLookup: z.string().min(1).max(254).optional(),
    /** Min 20 chars. Logged with the audit entry. */
    reason: z.string().min(20),
    /** Must equal `transfer ${project.slug}` exactly. */
    confirm: z.string().min(1),
    /** Stub MFA timestamp from the client (validated server-side). */
    mfaConfirmedAtMs: z.number().int().positive().optional(),
  })
  .refine((b) => Boolean(b.newOwnerUserId || b.recipientLookup), {
    message: "Provide either newOwnerUserId or recipientLookup.",
  });

/**
 * POST /api/projects/{id}/transfer — hand a project to another GitBags user.
 *
 *   - Re-validates the better-auth session (CVE-2025-29927 mitigation).
 *   - Requires `project.transfer` for the project.
 *   - Wrapped in `destructiveAction()` for reason+typed-confirmation+MFA.
 *   - Idempotent via `Idempotency-Key` header.
 *   - Audited as `project.transfer`.
 */
export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  if (!hasCredentials.db()) {
    return NextResponse.json(
      { error: "db_unavailable", message: "DB not configured." },
      { status: 503 },
    );
  }

  const { id: projectId } = await ctx.params;

  const h = await headers();
  const session = await auth().api.getSession({ headers: h });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const actorUserId = session.user.id;

  try {
    await requirePermission("project.transfer", {
      userId: actorUserId,
      projectId,
    });
  } catch (e) {
    if (e instanceof PermissionError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw e;
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

  // Load the project so we can render its slug into the typed-confirmation
  // template and build sensible audit metadata.
  const [proj] = await dbHttp
    .select({
      id: projects.id,
      ghOwner: projects.ghOwner,
      ghRepo: projects.ghRepo,
      name: projects.name,
      ownerUserId: projects.ownerUserId,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!proj) {
    return NextResponse.json({ error: "project_not_found" }, { status: 404 });
  }
  const slug = `${proj.ghOwner}/${proj.ghRepo}`;
  const expectedConfirmation = `transfer ${slug}`;

  // Resolve recipient. Prefer explicit user id; otherwise look up by email
  // or GitHub username. Reject ambiguous (>1) matches outright.
  let recipient: { id: string; name: string; email: string } | null = null;
  if (body.newOwnerUserId) {
    const [row] = await dbHttp
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, body.newOwnerUserId))
      .limit(1);
    recipient = row ?? null;
  } else if (body.recipientLookup) {
    const lookup = body.recipientLookup.trim();
    const rows = await dbHttp
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(or(eq(users.email, lookup), eq(users.githubUsername, lookup)))
      .limit(2);
    if (rows.length > 1) {
      return NextResponse.json(
        { error: "recipient_ambiguous", message: "Multiple users matched." },
        { status: 400 },
      );
    }
    recipient = rows[0] ?? null;
  }
  if (!recipient) {
    return NextResponse.json(
      { error: "recipient_not_found", message: "No GitBags user matched." },
      { status: 404 },
    );
  }

  if (recipient.id === proj.ownerUserId) {
    return NextResponse.json(
      {
        error: "recipient_already_owner",
        message: "Recipient already owns this project.",
      },
      { status: 400 },
    );
  }

  const idempotencyKey =
    h.get("idempotency-key") ??
    h.get("Idempotency-Key") ??
    `transfer:${projectId}:${recipient.id}`;
  const ip = h.get("x-forwarded-for") ?? null;
  const userAgent = h.get("user-agent") ?? null;
  const fromUserId = proj.ownerUserId;
  const toUserId = recipient.id;

  try {
    const result = await withIdempotency(idempotencyKey, async () => {
      return await destructiveAction(
        {
          actorUserId,
          permission: "project.transfer",
          projectId,
          reason: body.reason,
          targetName: expectedConfirmation,
          typedConfirmation: body.confirm,
          mfaConfirmedAtMs: body.mfaConfirmedAtMs,
          ip,
          userAgent,
        },
        {
          action: "project.transfer",
          targetType: "project",
          targetId: projectId,
          metadata: {
            slug,
            fromUserId,
            toUserId,
          },
        },
        async () => {
          const transfer = await transferProjectOwnership(
            projectId,
            toUserId,
            actorUserId,
          );

          // Outer audit — `destructiveAction` writes preflight/completed
          // wrappers; this is the canonical "what happened" entry the spec
          // wires us to emit.
          await audit({
            actorUserId,
            action: "project.transfer",
            targetType: "project",
            targetId: projectId,
            metadata: {
              slug,
              fromUserId,
              toUserId,
              reason: body.reason.trim(),
            },
            ip,
            userAgent,
          });

          return {
            ok: true as const,
            transferredTo: {
              id: transfer.newOwner.id,
              name: transfer.newOwner.name,
              email: transfer.newOwner.email,
            },
          };
        },
      );
    });

    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof MfaRequiredError) {
      return NextResponse.json(
        { error: "mfa_required", message: e.message },
        { status: 401 },
      );
    }
    if (e instanceof DestructiveActionError) {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: 400 },
      );
    }
    if (e instanceof PermissionError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    console.error("[projects/transfer] failed:", e);
    return NextResponse.json(
      { error: "transfer_failed", message: (e as Error).message },
      { status: 500 },
    );
  }
}
