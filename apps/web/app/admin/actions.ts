"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { dbHttp } from "@/db";
import {
  payouts,
  projects,
  users,
  platformConfig,
  snapshots,
  type PayoutConfig,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import { requirePermission } from "@/lib/auth/permissions";
import {
  destructiveAction,
  DestructiveActionError,
} from "@/lib/auth/destructive-action";
import { serverEnv } from "@/lib/env";
import { updateProjectCaches } from "@/lib/cache-actions";
import { PayoutConfigSchema, ScoringConfigSchema } from "@repo/shared";

/**
 * Server actions for the super-admin console.
 *
 * Each action:
 *  - Re-validates the session.
 *  - Calls `requirePermission` with the narrowest scope.
 *  - Validates inputs with Zod.
 *  - Wraps destructive ops in `destructiveAction`, idempotent ones in
 *    `withIdempotency`.
 *  - Returns `{ ok: true, ... }` or throws.
 */

async function requireSession(): Promise<{
  userId: string;
  ip: string | null;
  userAgent: string | null;
}> {
  const h = await headers();
  const session = await auth().api.getSession({ headers: h });
  if (!session?.user) throw new Error("unauthenticated");
  return {
    userId: session.user.id,
    ip: h.get("x-forwarded-for") ?? null,
    userAgent: h.get("user-agent") ?? null,
  };
}

const DestructiveBaseSchema = z.object({
  reason: z.string().min(20),
  typedConfirmation: z.string().min(1),
  mfaConfirmedAtMs: z.number().int().positive().optional(),
});

// ---------------------------------------------------------------------------
// Project lifecycle
// ---------------------------------------------------------------------------

const ProjectActionSchema = DestructiveBaseSchema.extend({
  projectId: z.string().min(1),
});

export async function pauseProject(input: unknown): Promise<{ ok: true }> {
  const parsed = ProjectActionSchema.parse(input);
  const ctx = await requireSession();

  const [proj] = await dbHttp
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.id, parsed.projectId))
    .limit(1);
  if (!proj) throw new Error("project_not_found");

  await destructiveAction(
    {
      actorUserId: ctx.userId,
      permission: "project.pause",
      projectId: proj.id,
      reason: parsed.reason,
      targetName: proj.name,
      typedConfirmation: parsed.typedConfirmation,
      mfaConfirmedAtMs: parsed.mfaConfirmedAtMs,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    },
    {
      action: "project.pause",
      targetType: "project",
      targetId: proj.id,
      metadata: { previousStatus: proj.id },
    },
    async () => {
      await dbHttp
        .update(projects)
        .set({
          status: "paused",
          pausedAt: new Date(),
          pausedReason: parsed.reason.slice(0, 500),
        })
        .where(eq(projects.id, proj.id));
    },
  );

  revalidatePath(`/admin/projects/${proj.id}`);
  revalidatePath("/admin/projects");
  await updateProjectCaches(proj.id);
  return { ok: true };
}

export async function killProject(input: unknown): Promise<{ ok: true }> {
  const parsed = ProjectActionSchema.parse(input);
  const ctx = await requireSession();

  const [proj] = await dbHttp
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.id, parsed.projectId))
    .limit(1);
  if (!proj) throw new Error("project_not_found");

  await destructiveAction(
    {
      actorUserId: ctx.userId,
      permission: "project.kill",
      projectId: proj.id,
      reason: parsed.reason,
      targetName: proj.name,
      typedConfirmation: parsed.typedConfirmation,
      mfaConfirmedAtMs: parsed.mfaConfirmedAtMs,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    },
    {
      action: "project.kill",
      targetType: "project",
      targetId: proj.id,
    },
    async () => {
      await dbHttp
        .update(projects)
        .set({ status: "killed", killedAt: new Date() })
        .where(eq(projects.id, proj.id));
    },
  );

  revalidatePath(`/admin/projects/${proj.id}`);
  revalidatePath("/admin/projects");
  await updateProjectCaches(proj.id);
  return { ok: true };
}

const UpdateScoringSchema = z.object({
  projectId: z.string().min(1),
  scoringConfig: ScoringConfigSchema,
  idempotencyKey: z.string().min(8).optional(),
});

export async function overrideScoringConfig(
  input: unknown,
): Promise<{ ok: true }> {
  const parsed = UpdateScoringSchema.parse(input);
  const ctx = await requireSession();

  await requirePermission("scoring.update", {
    userId: ctx.userId,
    projectId: parsed.projectId,
  });

  await withIdempotency(
    parsed.idempotencyKey ?? null,
    async () => {
      await dbHttp
        .update(projects)
        .set({ scoringConfig: parsed.scoringConfig })
        .where(eq(projects.id, parsed.projectId));
      await audit({
        actorUserId: ctx.userId,
        action: "scoring.update",
        targetType: "project",
        targetId: parsed.projectId,
        metadata: { override: true, scoringConfig: parsed.scoringConfig },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    },
    { scope: `admin:scoring:${parsed.projectId}:${ctx.userId}` },
  );

  revalidatePath(`/admin/projects/${parsed.projectId}`);
  await updateProjectCaches(parsed.projectId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

const PayoutIdSchema = z.object({
  payoutId: z.string().min(1),
  idempotencyKey: z.string().min(8).optional(),
});

export async function retryPayout(input: unknown): Promise<{ ok: true }> {
  const parsed = PayoutIdSchema.parse(input);
  const ctx = await requireSession();

  const [row] = await dbHttp
    .select({
      id: payouts.id,
      status: payouts.status,
      attemptCount: payouts.attemptCount,
      projectId: payouts.projectId,
    })
    .from(payouts)
    .where(eq(payouts.id, parsed.payoutId))
    .limit(1);
  if (!row) throw new Error("payout_not_found");

  await requirePermission("payouts.retry", {
    userId: ctx.userId,
    projectId: row.projectId,
  });

  await withIdempotency(
    parsed.idempotencyKey ?? `payout:retry:${row.id}`,
    async () => {
      await dbHttp
        .update(payouts)
        .set({
          status: "pending",
          attemptCount: row.attemptCount + 1,
          lastError: null,
        })
        .where(eq(payouts.id, row.id));
      await audit({
        actorUserId: ctx.userId,
        action: "payout.retry",
        targetType: "payout",
        targetId: row.id,
        metadata: { previousStatus: row.status, attempt: row.attemptCount + 1 },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    },
    { scope: `admin:payout:retry:${row.projectId}:${ctx.userId}` },
  );

  revalidatePath("/admin/payouts");
  await updateProjectCaches(row.projectId);
  return { ok: true };
}

const CancelPayoutSchema = DestructiveBaseSchema.extend({
  payoutId: z.string().min(1),
});

export async function cancelPayout(input: unknown): Promise<{ ok: true }> {
  const parsed = CancelPayoutSchema.parse(input);
  const ctx = await requireSession();

  const [row] = await dbHttp
    .select({
      id: payouts.id,
      status: payouts.status,
      projectId: payouts.projectId,
    })
    .from(payouts)
    .where(eq(payouts.id, parsed.payoutId))
    .limit(1);
  if (!row) throw new Error("payout_not_found");

  if (!["pending", "claiming", "distributing"].includes(row.status)) {
    throw new Error("payout_not_cancellable");
  }

  await destructiveAction(
    {
      actorUserId: ctx.userId,
      permission: "payouts.cancel",
      projectId: row.projectId,
      reason: parsed.reason,
      targetName: row.id,
      typedConfirmation: parsed.typedConfirmation,
      mfaConfirmedAtMs: parsed.mfaConfirmedAtMs,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    },
    {
      action: "payout.cancel",
      targetType: "payout",
      targetId: row.id,
      metadata: { previousStatus: row.status },
    },
    async () => {
      await dbHttp
        .update(payouts)
        .set({ status: "cancelled" })
        .where(eq(payouts.id, row.id));
    },
  );

  revalidatePath("/admin/payouts");
  await updateProjectCaches(row.projectId);
  return { ok: true };
}

const ForceSnapshotSchema = z.object({
  projectId: z.string().min(1),
  idempotencyKey: z.string().min(8).optional(),
});

export async function forceSnapshot(input: unknown): Promise<{ ok: true }> {
  const parsed = ForceSnapshotSchema.parse(input);
  const ctx = await requireSession();

  await requirePermission("snapshot.force", {
    userId: ctx.userId,
    projectId: parsed.projectId,
  });

  // The actual snapshot work is performed by `takeSnapshot` / `computeLeaderboard`
  // workflows. For v0 we audit the manual trigger and flag a row in
  // platform_config the workflow can pick up. The real workflow integration
  // will fire `start(takeSnapshot, [projectId])` once Agent B's pipeline is
  // wired in.
  // TODO(v1.1): kick off `start(takeSnapshot, [projectId])`.
  await withIdempotency(
    parsed.idempotencyKey ?? `snapshot:force:${parsed.projectId}`,
    async () => {
      const value = {
        projectId: parsed.projectId,
        requestedBy: ctx.userId,
        requestedAt: new Date().toISOString(),
      };
      await dbHttp
        .insert(platformConfig)
        .values({
          key: `pending.snapshot.${parsed.projectId}`,
          value,
          updatedBy: ctx.userId,
        })
        .onConflictDoUpdate({
          target: platformConfig.key,
          set: { value, updatedBy: ctx.userId, updatedAt: new Date() },
        });
      await audit({
        actorUserId: ctx.userId,
        action: "snapshot.force",
        targetType: "project",
        targetId: parsed.projectId,
        metadata: { manualTrigger: true },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    },
    { scope: `admin:snapshot:force:${parsed.projectId}:${ctx.userId}` },
  );

  revalidatePath(`/admin/projects/${parsed.projectId}`);
  await updateProjectCaches(parsed.projectId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Fees
// ---------------------------------------------------------------------------

const UpdateFeesSchema = DestructiveBaseSchema.extend({
  bps: z.number().int().min(0).max(2000),
});

export async function updateFeesBps(
  input: unknown,
): Promise<{ ok: true; bps: number }> {
  const parsed = UpdateFeesSchema.parse(input);
  const ctx = await requireSession();

  await destructiveAction(
    {
      actorUserId: ctx.userId,
      permission: "platform.fees.update",
      reason: parsed.reason,
      targetName: "platform.fees.bps",
      typedConfirmation: parsed.typedConfirmation,
      mfaConfirmedAtMs: parsed.mfaConfirmedAtMs,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    },
    {
      action: "fees.update",
      targetType: "platform_config",
      targetId: "fees.platform_bps",
      metadata: { bps: parsed.bps },
    },
    async () => {
      const value = { value: parsed.bps, updatedBy: ctx.userId };
      await dbHttp
        .insert(platformConfig)
        .values({
          key: "fees.platform_bps",
          value,
          updatedBy: ctx.userId,
        })
        .onConflictDoUpdate({
          target: platformConfig.key,
          set: { value, updatedBy: ctx.userId, updatedAt: new Date() },
        });
    },
  );

  revalidatePath("/admin/fees");
  return { ok: true, bps: parsed.bps };
}

// ---------------------------------------------------------------------------
// Kill switch + maintenance
// ---------------------------------------------------------------------------

const KillSwitchSchema = DestructiveBaseSchema.extend({
  enabled: z.boolean(),
});

export async function toggleKillSwitch(
  input: unknown,
): Promise<{ ok: true; enabled: boolean }> {
  const parsed = KillSwitchSchema.parse(input);
  const ctx = await requireSession();

  // Confirmation copy requirement: see /admin/maintenance UI — the operator
  // must type "ENABLE KILL SWITCH" or "DISABLE KILL SWITCH" depending on
  // direction. We compute the canonical name here.
  const targetName = parsed.enabled
    ? "ENABLE KILL SWITCH"
    : "DISABLE KILL SWITCH";

  await destructiveAction(
    {
      actorUserId: ctx.userId,
      permission: "platform.kill_switch",
      reason: parsed.reason,
      targetName,
      typedConfirmation: parsed.typedConfirmation,
      mfaConfirmedAtMs: parsed.mfaConfirmedAtMs,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    },
    {
      action: "kill_switch.toggle",
      targetType: "platform_config",
      targetId: "kill_switch.global",
      metadata: { enabled: parsed.enabled, reason: parsed.reason },
    },
    async () => {
      const value = {
        enabled: parsed.enabled,
        reason: parsed.reason.slice(0, 500),
        toggledBy: ctx.userId,
        toggledAt: new Date().toISOString(),
      };
      await dbHttp
        .insert(platformConfig)
        .values({
          key: "kill_switch.global",
          value,
          updatedBy: ctx.userId,
        })
        .onConflictDoUpdate({
          target: platformConfig.key,
          set: { value, updatedBy: ctx.userId, updatedAt: new Date() },
        });
    },
  );

  revalidatePath("/admin/maintenance");
  return { ok: true, enabled: parsed.enabled };
}

const BannerSchema = z.object({
  message: z.string().max(500),
  visible: z.boolean(),
});

export async function updateBanner(input: unknown): Promise<{ ok: true }> {
  const parsed = BannerSchema.parse(input);
  const ctx = await requireSession();

  await requirePermission("platform.maintenance", { userId: ctx.userId });

  const value = {
    message: parsed.message,
    visible: parsed.visible,
    updatedBy: ctx.userId,
    updatedAt: new Date().toISOString(),
  };
  await dbHttp
    .insert(platformConfig)
    .values({ key: "banner.global", value, updatedBy: ctx.userId })
    .onConflictDoUpdate({
      target: platformConfig.key,
      set: { value, updatedBy: ctx.userId, updatedAt: new Date() },
    });

  await audit({
    actorUserId: ctx.userId,
    action: "admin.access",
    targetType: "platform_config",
    targetId: "banner.global",
    metadata: { ...parsed },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  revalidatePath("/admin/maintenance");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const GrantRoleSchema = DestructiveBaseSchema.extend({
  userId: z.string().min(1),
  role: z.enum(["user", "moderator", "admin", "super_admin"]),
});

export async function grantRole(input: unknown): Promise<{ ok: true }> {
  const parsed = GrantRoleSchema.parse(input);
  const ctx = await requireSession();

  const [target] = await dbHttp
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, parsed.userId))
    .limit(1);
  if (!target) throw new Error("user_not_found");

  await destructiveAction(
    {
      actorUserId: ctx.userId,
      permission: "admin.users.role.grant",
      reason: parsed.reason,
      targetName: target.name,
      typedConfirmation: parsed.typedConfirmation,
      mfaConfirmedAtMs: parsed.mfaConfirmedAtMs,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    },
    {
      action: "user.role_grant",
      targetType: "user",
      targetId: target.id,
      metadata: { previousRole: target.role, newRole: parsed.role },
    },
    async () => {
      await dbHttp
        .update(users)
        .set({ role: parsed.role })
        .where(eq(users.id, target.id));
    },
  );

  revalidatePath("/admin/users");
  return { ok: true };
}

const ResetMfaSchema = DestructiveBaseSchema.extend({
  userId: z.string().min(1),
});

export async function resetUserMfa(input: unknown): Promise<{ ok: true }> {
  const parsed = ResetMfaSchema.parse(input);
  const ctx = await requireSession();

  const [target] = await dbHttp
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, parsed.userId))
    .limit(1);
  if (!target) throw new Error("user_not_found");

  await destructiveAction(
    {
      actorUserId: ctx.userId,
      permission: "admin.users.role.grant",
      reason: parsed.reason,
      targetName: target.name,
      typedConfirmation: parsed.typedConfirmation,
      mfaConfirmedAtMs: parsed.mfaConfirmedAtMs,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    },
    {
      action: "admin.access",
      targetType: "user",
      targetId: target.id,
      metadata: { op: "reset_mfa" },
    },
    async () => {
      await dbHttp
        .update(users)
        .set({ mfaSecretEnc: null })
        .where(eq(users.id, target.id));
    },
  );

  revalidatePath("/admin/users");
  return { ok: true };
}

const SybilFlagSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().min(20),
});

export async function sybilFlagUser(input: unknown): Promise<{ ok: true }> {
  const parsed = SybilFlagSchema.parse(input);
  const ctx = await requireSession();

  await requirePermission("admin.users.role.grant", { userId: ctx.userId });

  await audit({
    actorUserId: ctx.userId,
    action: "admin.access",
    targetType: "user",
    targetId: parsed.userId,
    metadata: { kind: "abuse.sybil_flag", reason: parsed.reason },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/abuse");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Treasury (read-only top-up stub)
// ---------------------------------------------------------------------------

export async function topUpHotWallet(): Promise<{ ok: false; reason: string }> {
  const ctx = await requireSession();
  await requirePermission("platform.treasury.topup", { userId: ctx.userId });
  await audit({
    actorUserId: ctx.userId,
    action: "treasury.topup",
    targetType: "treasury",
    targetId: "hot_wallet",
    metadata: { stub: true, reason: "manual cold-treasury topup is v1.1" },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return {
    ok: false,
    reason: "Hot wallet top-up requires cold-treasury MFA (manual, v1.1)",
  };
}

// ---------------------------------------------------------------------------
// Workflow re-trigger
// ---------------------------------------------------------------------------

const TriggerWorkflowSchema = z.object({
  name: z.enum([
    "healthPulse",
    "indexGithubDeltas",
    "computeLeaderboard",
    "takeSnapshot",
    "executePayout",
    "expireEscrow",
    "processClaim",
  ]),
});

export async function retriggerWorkflow(
  input: unknown,
): Promise<{ ok: true; runId?: string }> {
  const parsed = TriggerWorkflowSchema.parse(input);
  const ctx = await requireSession();

  await requirePermission("admin.workflows.inspect", { userId: ctx.userId });

  // Only the args-free workflows can be triggered manually here. Workflows
  // that need arguments (processClaim, takeSnapshot, processSnapshotPayout)
  // are not invoked from this control surface.
  // TODO(v1.1): kick off the actual workflow run via `start(...)`.
  await audit({
    actorUserId: ctx.userId,
    action: "admin.access",
    targetType: "workflow",
    targetId: parsed.name,
    metadata: { kind: "retrigger", note: "v0 audit-only stub" },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Snapshot leaderboard helpers
// ---------------------------------------------------------------------------

const RecomputeLeaderboardSchema = z.object({
  projectId: z.string().min(1),
});

export async function recomputeLeaderboard(
  input: unknown,
): Promise<{ ok: true }> {
  const parsed = RecomputeLeaderboardSchema.parse(input);
  const ctx = await requireSession();

  await requirePermission("scoring.update", {
    userId: ctx.userId,
    projectId: parsed.projectId,
  });

  await audit({
    actorUserId: ctx.userId,
    action: "scoring.update",
    targetType: "project",
    targetId: parsed.projectId,
    metadata: { kind: "recompute_leaderboard" },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  revalidatePath(`/admin/projects/${parsed.projectId}`);
  await updateProjectCaches(parsed.projectId);
  return { ok: true };
}

const UpdatePayoutConfigSchema = z.object({
  projectId: z.string().min(1),
  payoutConfig: PayoutConfigSchema,
});

export async function updatePayoutConfig(
  input: unknown,
): Promise<{ ok: true }> {
  const parsed = UpdatePayoutConfigSchema.parse(input);
  const ctx = await requireSession();
  await requirePermission("project.update", {
    userId: ctx.userId,
    projectId: parsed.projectId,
  });
  await dbHttp
    .update(projects)
    .set({ payoutConfig: parsed.payoutConfig satisfies PayoutConfig })
    .where(eq(projects.id, parsed.projectId));
  await audit({
    actorUserId: ctx.userId,
    action: "scoring.update",
    targetType: "project",
    targetId: parsed.projectId,
    metadata: { kind: "payout_config_override" },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  revalidatePath(`/admin/projects/${parsed.projectId}`);
  await updateProjectCaches(parsed.projectId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Audit CSV export
// ---------------------------------------------------------------------------

const AuditExportSchema = z.object({
  prefix: z.string().optional(),
  sinceMs: z.number().int().positive().optional(),
});

export async function exportAuditCsv(
  input: unknown,
): Promise<{ ok: true; csv: string }> {
  const parsed = AuditExportSchema.parse(input ?? {});
  const ctx = await requireSession();
  await requirePermission("admin.audit.read", { userId: ctx.userId });
  const { getAuditLogs } = await import("@/lib/queries/admin");
  const rows = await getAuditLogs({
    actionPrefix: parsed.prefix,
    sinceMs: parsed.sinceMs,
    limit: 500,
  });

  const header = [
    "id",
    "createdAt",
    "actorUserId",
    "actorName",
    "action",
    "targetType",
    "targetId",
    "metadata",
  ].join(",");
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.id,
      r.createdAt.toISOString(),
      r.actorUserId ?? "",
      escape(r.actorName ?? ""),
      r.action,
      r.targetType,
      r.targetId,
      escape(JSON.stringify(r.metadata)),
    ].join(","),
  );

  await audit({
    actorUserId: ctx.userId,
    action: "admin.access",
    targetType: "audit_log",
    targetId: "csv_export",
    metadata: { prefix: parsed.prefix ?? null, count: rows.length },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return { ok: true, csv: [header, ...lines].join("\n") };
}

// Re-export so client code can import + check error type cleanly.
export { DestructiveActionError };
// Force serverEnv import to retain so tree-shaking doesn't elide it; it's used
// by destructive-action transitively but importing here keeps the boundary obvious.
void serverEnv;
void snapshots;
