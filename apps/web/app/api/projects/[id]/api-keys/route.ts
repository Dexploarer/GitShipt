import "server-only";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  hasPermission,
  PermissionError,
  requirePermission,
} from "@/lib/auth/permissions";
import { getProjectRecord } from "@/lib/queries/dashboard";
import { audit } from "@/lib/audit";
import { hasCredentials } from "@/lib/env";
import { IdempotencyReplayError, withIdempotency } from "@/lib/idempotency";
import { check } from "@/lib/rate-limit";
import { createApiKey, listApiKeysForProject } from "@/lib/queries/api-keys";
import { ProjectApiKeyScopesSchema } from "@repo/shared";
import { revalidateProjectCaches } from "@/lib/cache";
import { privateNoStoreJson } from "@/lib/no-store-response";


const CreateBodySchema = z.object({
  name: z.string().min(1).max(64),
  scopes: ProjectApiKeyScopesSchema.default([
    "read:project",
    "read:leaderboard",
    "read:payouts",
    "read:token",
  ]),
});

/**
 * Per-project API key collection routes. Both methods require the caller to
 * hold `project.update` for the project (i.e. project owner or super-admin).
 *
 *   POST  → mint a new key. The raw key is returned ONCE in this response.
 *   GET   → list non-revoked keys (no raw key ever exposed).
 */
async function authorize(
  projectId: string,
): Promise<{ ok: true; userId: string } | { ok: false; res: Response }> {
  if (!hasCredentials.db()) {
    return {
      ok: false,
      res: privateNoStoreJson({ error: "db_unavailable" }, { status: 503 }),
    };
  }
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user) {
    return {
      ok: false,
      res: privateNoStoreJson({ error: "unauthenticated" }, { status: 401 }),
    };
  }
  const project = await getProjectRecord(projectId);
  if (!project) {
    return {
      ok: false,
      res: privateNoStoreJson({ error: "not_found" }, { status: 404 }),
    };
  }
  const ok = await hasPermission("project.update", {
    userId: session.user.id,
    projectId,
  });
  if (!ok) {
    return {
      ok: false,
      res: privateNoStoreJson({ error: "not_found" }, { status: 404 }),
    };
  }
  try {
    await requirePermission("project.update", {
      userId: session.user.id,
      projectId,
    });
  } catch (e) {
    if (e instanceof PermissionError) {
      return {
        ok: false,
        res: privateNoStoreJson({ error: "not_found" }, { status: 404 }),
      };
    }
    throw e;
  }
  return { ok: true, userId: session.user.id };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: projectId } = await params;
  const authz = await authorize(projectId);
  if (!authz.ok) return authz.res;
  const userId = authz.userId;

  const rl = await check("api-key", `mint:${userId}:${projectId}`);
  if (!rl.success) {
    return privateNoStoreJson({ error: "rate_limited" }, { status: 429 });
  }

  let body: z.infer<typeof CreateBodySchema>;
  try {
    body = CreateBodySchema.parse(await req.json());
  } catch (e) {
    return privateNoStoreJson(
      { error: "invalid_body", details: (e as Error).message },
      { status: 400 },
    );
  }

  const idemKey = req.headers.get("idempotency-key");
  if (!idemKey) {
    return privateNoStoreJson(
      { error: "idempotency_key_required" },
      { status: 400 },
    );
  }

  try {
    const result = await withIdempotency(
      idemKey,
      async () => {
        const { rawKey, row } = await createApiKey(
          projectId,
          body.name,
          userId,
          body.scopes,
        );
        await audit({
          actorUserId: userId,
          action: "project.api_key_create",
          targetType: "api_key",
          targetId: row.id,
          metadata: {
            projectId,
            name: row.name,
            prefix: row.prefix,
            lastFourPlain: row.lastFourPlain,
            scopes: row.scopes,
          },
          ip: req.headers.get("x-forwarded-for") ?? null,
          userAgent: req.headers.get("user-agent") ?? null,
        });
        return {
          rawKey,
          key: {
            id: row.id,
            name: row.name,
            prefix: row.prefix,
            lastFourPlain: row.lastFourPlain,
            scopes: row.scopes,
            createdAt: row.createdAt.toISOString(),
          },
        };
      },
      {
        scope: `api-key:create:${projectId}:${userId}`,
        cacheResult: false,
      },
    );
    await revalidateProjectCaches(projectId);
    return privateNoStoreJson(result, { status: 201 });
  } catch (e) {
    if (e instanceof IdempotencyReplayError) {
      return privateNoStoreJson(
        {
          error: "idempotency_replay",
          message:
            "This API key creation already completed. Raw keys are shown once and are not cached for replay.",
        },
        { status: 409 },
      );
    }
    console.error("[api-keys/create] failed:", e);
    return privateNoStoreJson(
      { error: "create_failed", message: (e as Error).message },
      { status: 500 },
    );
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: projectId } = await params;
  const authz = await authorize(projectId);
  if (!authz.ok) return authz.res;

  const keys = await listApiKeysForProject(projectId);
  return privateNoStoreJson(
    {
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        lastFourPlain: k.lastFourPlain,
        scopes: k.scopes,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
        createdByUserId: k.createdByUserId,
      })),
    },
    { status: 200 },
  );
}
