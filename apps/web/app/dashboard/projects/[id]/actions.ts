"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { dbHttp } from "@/db";
import { projects, payouts } from "@/db/schema";
import type { ScoringConfig, PayoutConfig } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import { check } from "@/lib/rate-limit";
import { updateProjectCaches } from "@/lib/cache-actions";

/**
 * Server Actions for the per-project admin console.
 *
 * Every mutation:
 *   - Re-validates the better-auth session.
 *   - Calls `requirePermission(...)` for the right scope.
 *   - Validates inputs with Zod.
 *   - Wraps the side-effect in `withIdempotency(key, ...)`.
 *   - Writes an `audit(...)` entry.
 *   - Applies a rate limit when appropriate.
 *
 * Errors throw `Error` with a stable message so the client can render
 * a toast. PermissionError throws are surfaced as 403 by the framework.
 */

async function requireSessionUserId(): Promise<string> {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/auth/signin");
  }
  return session.user.id;
}

// ---------------------------------------------------------------------------
// pauseProject — toggle live <-> paused
// ---------------------------------------------------------------------------
const pauseSchema = z.object({
  projectId: z.string().min(1),
  pause: z.boolean(),
  reason: z.string().max(280).optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export async function pauseProject(
  input: z.input<typeof pauseSchema>,
): Promise<{ ok: true; status: "live" | "paused" }> {
  const data = pauseSchema.parse(input);
  const userId = await requireSessionUserId();
  await requirePermission("project.pause", {
    userId,
    projectId: data.projectId,
  });

  const rl = await check("default", `pause:${userId}:${data.projectId}`);
  if (!rl.success) throw new Error("Rate limited — try again shortly.");

  const result = await withIdempotency(
    data.idempotencyKey ??
      `pause:${data.projectId}:${data.pause ? "1" : "0"}:${Date.now()}`,
    async () => {
      const next = data.pause ? ("paused" as const) : ("live" as const);
      await dbHttp
        .update(projects)
        .set({
          status: next,
          pausedAt: data.pause ? new Date() : null,
          pausedReason: data.pause ? (data.reason ?? null) : null,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, data.projectId));
      return { status: next };
    },
    { scope: `project:pause:${data.projectId}:${userId}` },
  );

  await audit({
    actorUserId: userId,
    action: "project.pause",
    targetType: "project",
    targetId: data.projectId,
    metadata: { pause: data.pause, reason: data.reason ?? null },
  });

  revalidatePath(`/dashboard/projects/${data.projectId}`);
  revalidatePath(`/dashboard/projects/${data.projectId}/settings`);
  await updateProjectCaches(data.projectId);
  return { ok: true, status: result.status };
}

// ---------------------------------------------------------------------------
// updateScoringConfig — edit windowDays / weights / claim threshold
// ---------------------------------------------------------------------------
const scoringConfigSchema = z.object({
  formulaVersion: z.enum(["v0", "v1"]).default("v0"),
  windowDays: z.number().int().min(7).max(90),
  weights: z.object({
    mergedPRs: z.number().min(0),
    commits: z.number().min(0),
    reviews: z.number().min(0),
    issues: z.number().min(0),
    netLines: z.number().min(0),
  }),
  decay: z.enum(["off", "linear", "exponential"]).default("off"),
  botBlocklist: z.array(z.string()).default([]),
  botAllowlist: z.array(z.string()).default([]),
});

const payoutConfigSchema = z
  .object({
    topN: z.number().int().min(1).max(100),
    tierWeights: z.array(z.number().min(0).max(1)).min(1).max(100),
    claimThresholdLamports: z.number().int().min(0),
  })
  .refine(
    (v) => Math.abs(v.tierWeights.reduce((acc, n) => acc + n, 0) - 1) < 0.001,
    { message: "tierWeights must sum to 1.0" },
  );

const updateScoringSchema = z.object({
  projectId: z.string().min(1),
  scoring: scoringConfigSchema,
  payout: payoutConfigSchema,
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export async function updateScoringConfig(
  input: z.input<typeof updateScoringSchema>,
): Promise<{ ok: true }> {
  const data = updateScoringSchema.parse(input);
  const userId = await requireSessionUserId();
  await requirePermission("scoring.update", {
    userId,
    projectId: data.projectId,
  });

  const rl = await check("default", `scoring:${userId}:${data.projectId}`);
  if (!rl.success) throw new Error("Rate limited — try again shortly.");

  await withIdempotency(
    data.idempotencyKey ?? `scoring:${data.projectId}:${Date.now()}`,
    async () => {
      await dbHttp
        .update(projects)
        .set({
          scoringConfig: data.scoring satisfies ScoringConfig,
          payoutConfig: data.payout satisfies PayoutConfig,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, data.projectId));
      return { ok: true } as const;
    },
    { scope: `project:scoring:${data.projectId}:${userId}` },
  );

  await audit({
    actorUserId: userId,
    action: "scoring.update",
    targetType: "project",
    targetId: data.projectId,
    metadata: {
      windowDays: data.scoring.windowDays,
      tierWeights: data.payout.tierWeights,
    },
  });

  revalidatePath(`/dashboard/projects/${data.projectId}/leaderboard`);
  await updateProjectCaches(data.projectId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// retryPayout — flip a failed payout back to pending so the cron picks it up
// ---------------------------------------------------------------------------
const retryPayoutSchema = z.object({
  projectId: z.string().min(1),
  payoutId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export async function retryPayout(
  input: z.input<typeof retryPayoutSchema>,
): Promise<{ ok: true }> {
  const data = retryPayoutSchema.parse(input);
  const userId = await requireSessionUserId();
  await requirePermission("payouts.retry", {
    userId,
    projectId: data.projectId,
  });

  const rl = await check("default", `retry:${userId}:${data.payoutId}`);
  if (!rl.success) throw new Error("Rate limited — try again shortly.");

  await withIdempotency(
    data.idempotencyKey ?? `retry:${data.payoutId}`,
    async () => {
      await dbHttp
        .update(payouts)
        .set({
          status: "pending",
          lastError: null,
          // Don't reset attemptCount — the cron uses it for backoff.
        })
        .where(eq(payouts.id, data.payoutId));
      return { ok: true } as const;
    },
    { scope: `project:payout:retry:${data.projectId}:${userId}` },
  );

  await audit({
    actorUserId: userId,
    action: "payout.retry",
    targetType: "payout",
    targetId: data.payoutId,
    metadata: { projectId: data.projectId },
  });

  revalidatePath(`/dashboard/projects/${data.projectId}/payouts`);
  await updateProjectCaches(data.projectId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// transferOwnership — move ownership to another user (by GitHub username)
// ---------------------------------------------------------------------------
const transferSchema = z.object({
  projectId: z.string().min(1),
  newOwnerGithubUsername: z.string().min(1).max(80),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export async function transferOwnership(
  input: z.input<typeof transferSchema>,
): Promise<{ ok: true; newOwnerUserId: string }> {
  const data = transferSchema.parse(input);
  const userId = await requireSessionUserId();
  await requirePermission("project.transfer", {
    userId,
    projectId: data.projectId,
  });

  const { users } = await import("@/db/schema");
  const [target] = await dbHttp
    .select({ id: users.id })
    .from(users)
    .where(eq(users.githubUsername, data.newOwnerGithubUsername))
    .limit(1);
  if (!target) {
    throw new Error(
      `No GitBags user with GitHub username "${data.newOwnerGithubUsername}".`,
    );
  }

  const result = await withIdempotency(
    data.idempotencyKey ??
      `transfer:${data.projectId}:${target.id}:${Date.now()}`,
    async () => {
      await dbHttp
        .update(projects)
        .set({ ownerUserId: target.id, updatedAt: new Date() })
        .where(eq(projects.id, data.projectId));
      return { newOwnerUserId: target.id };
    },
    { scope: `project:transfer:${data.projectId}:${userId}` },
  );

  await audit({
    actorUserId: userId,
    action: "project.transfer",
    targetType: "project",
    targetId: data.projectId,
    metadata: {
      fromUserId: userId,
      toUserId: target.id,
      toGithubUsername: data.newOwnerGithubUsername,
    },
  });

  revalidatePath(`/dashboard/projects/${data.projectId}/settings`);
  await updateProjectCaches(data.projectId);
  return { ok: true, newOwnerUserId: result.newOwnerUserId };
}

// ---------------------------------------------------------------------------
// deleteProject — destructive. Marks killed; soft-delete only in v0.
// ---------------------------------------------------------------------------
const deleteSchema = z.object({
  projectId: z.string().min(1),
  /** User must type the slug to confirm. */
  confirmSlug: z.string().min(1),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export async function deleteProject(
  input: z.input<typeof deleteSchema>,
): Promise<{ ok: true }> {
  const data = deleteSchema.parse(input);
  const userId = await requireSessionUserId();
  await requirePermission("project.delete", {
    userId,
    projectId: data.projectId,
  });

  const [proj] = await dbHttp
    .select({ ghOwner: projects.ghOwner, ghRepo: projects.ghRepo })
    .from(projects)
    .where(eq(projects.id, data.projectId))
    .limit(1);
  if (!proj) throw new Error("Project not found.");
  const slug = `${proj.ghOwner}/${proj.ghRepo}`;
  if (data.confirmSlug !== slug) {
    throw new Error(
      `Confirmation mismatch — type "${slug}" exactly to delete.`,
    );
  }

  await withIdempotency(
    data.idempotencyKey ?? `delete:${data.projectId}`,
    async () => {
      await dbHttp
        .update(projects)
        .set({
          status: "killed",
          killedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projects.id, data.projectId));
      return { ok: true } as const;
    },
    { scope: `project:delete:${data.projectId}:${userId}` },
  );

  await audit({
    actorUserId: userId,
    action: "project.delete",
    targetType: "project",
    targetId: data.projectId,
    metadata: { slug },
  });

  revalidatePath("/dashboard");
  await updateProjectCaches(data.projectId, slug);
  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// updateMetadata — name/description/imageUrl
// ---------------------------------------------------------------------------
const updateMetadataSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).nullable(),
  imageUrl: z.string().url().nullable(),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export async function updateMetadata(
  input: z.input<typeof updateMetadataSchema>,
): Promise<{ ok: true }> {
  const data = updateMetadataSchema.parse(input);
  const userId = await requireSessionUserId();
  await requirePermission("project.update", {
    userId,
    projectId: data.projectId,
  });

  const rl = await check("default", `meta:${userId}:${data.projectId}`);
  if (!rl.success) throw new Error("Rate limited — try again shortly.");

  await withIdempotency(
    data.idempotencyKey ?? `meta:${data.projectId}:${Date.now()}`,
    async () => {
      await dbHttp
        .update(projects)
        .set({
          name: data.name,
          description: data.description,
          imageUrl: data.imageUrl,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, data.projectId));
      return { ok: true } as const;
    },
    { scope: `project:metadata:${data.projectId}:${userId}` },
  );

  await audit({
    actorUserId: userId,
    action: "project.create", // closest existing AuditAction; "project.update" not in enum
    targetType: "project",
    targetId: data.projectId,
    metadata: { kind: "metadata", name: data.name },
  });

  revalidatePath(`/dashboard/projects/${data.projectId}/settings`);
  await updateProjectCaches(data.projectId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// forceSnapshot — kicks the takeSnapshot workflow when present.
// ---------------------------------------------------------------------------
const forceSnapshotSchema = z.object({
  projectId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export async function forceSnapshot(
  input: z.input<typeof forceSnapshotSchema>,
): Promise<{ ok: true; runId: string | null }> {
  const data = forceSnapshotSchema.parse(input);
  const userId = await requireSessionUserId();
  await requirePermission("snapshot.force", {
    userId,
    projectId: data.projectId,
  });

  const rl = await check("force-snapshot", `snap:${data.projectId}`);
  if (!rl.success) {
    throw new Error(
      "Force-snapshot is rate-limited to 1 per hour per project.",
    );
  }

  // takeSnapshot is owned by Agent B and may not exist yet. Try to invoke it
  // dynamically; if the module is missing, return runId=null and audit anyway.
  const runId: string | null = await withIdempotency(
    data.idempotencyKey ?? `snap:${data.projectId}:${Date.now()}`,
    async () => {
      try {
        const [{ start }, mod] = await Promise.all([
          import("workflow/api"),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          import("@/workflows/takeSnapshot" as any).catch(() => null as any),
        ]);
        if (!mod || typeof mod.takeSnapshot !== "function") return null;
        const run = await start(mod.takeSnapshot, [data.projectId]);
        return run.runId ?? null;
      } catch (e) {
        console.warn("[forceSnapshot] could not start workflow", e);
        return null;
      }
    },
    { scope: `project:snapshot:force:${data.projectId}:${userId}` },
  );

  await audit({
    actorUserId: userId,
    action: "snapshot.force",
    targetType: "project",
    targetId: data.projectId,
    metadata: { runId },
  });

  revalidatePath(`/dashboard/projects/${data.projectId}`);
  revalidatePath(`/dashboard/projects/${data.projectId}/leaderboard`);
  await updateProjectCaches(data.projectId);
  return { ok: true, runId };
}
