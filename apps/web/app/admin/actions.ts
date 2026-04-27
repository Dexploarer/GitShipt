"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { start } from "workflow/api";
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
import { deriveKey, withIdempotency } from "@/lib/idempotency";
import { requirePermission } from "@/lib/auth/permissions";
import {
  destructiveAction,
  DestructiveActionError,
} from "@/lib/auth/destructive-action";
import { serverEnv } from "@/lib/env";
import { updateProjectCaches } from "@/lib/cache-actions";
import { PayoutConfigSchema, ScoringConfigSchema } from "@repo/shared";
import { healthPulse } from "@/workflows/healthPulse";
import { indexGithubDeltas } from "@/workflows/indexGithubDeltas";
import { takeSnapshot, takeProjectSnapshot } from "@/workflows/takeSnapshot";
import { executePayout } from "@/workflows/executePayout";
import { expireEscrow } from "@/workflows/expireEscrow";
import { publishKpis } from "@/workflows/publishKpis";
import { computeLeaderboard as computeLeaderboardWorkflow } from "@/workflows/computeLeaderboard";

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

export async function forceSnapshot(
  input: unknown,
): Promise<{ ok: true; runId: string | null }> {
  const parsed = ForceSnapshotSchema.parse(input);
  const ctx = await requireSession();

  await requirePermission("snapshot.force", {
    userId: ctx.userId,
    projectId: parsed.projectId,
  });

  const runId = await withIdempotency(
    parsed.idempotencyKey ?? `snapshot:force:${parsed.projectId}`,
    async () => {
      const run = await start(takeProjectSnapshot, [parsed.projectId]);
      const value = {
        projectId: parsed.projectId,
        requestedBy: ctx.userId,
        requestedAt: new Date().toISOString(),
        runId: run.runId,
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
        metadata: { manualTrigger: true, runId: run.runId },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return run.runId;
    },
    { scope: `admin:snapshot:force:${parsed.projectId}:${ctx.userId}` },
  );

  revalidatePath(`/admin/projects/${parsed.projectId}`);
  await updateProjectCaches(parsed.projectId);
  return { ok: true, runId };
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

const UpdateProjectFeeShareSchema = DestructiveBaseSchema.extend({
  projectId: z.string().min(1),
  bps: z.number().int().min(0).max(2000),
});

export async function updateProjectPlatformFeeBps(
  input: unknown,
): Promise<{ ok: true; bps: number }> {
  const parsed = UpdateProjectFeeShareSchema.parse(input);
  const ctx = await requireSession();

  const [proj] = await dbHttp
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      platformFeeBps: projects.platformFeeBps,
      bagsConfigKey: projects.bagsConfigKey,
    })
    .from(projects)
    .where(eq(projects.id, parsed.projectId))
    .limit(1);
  if (!proj) throw new Error("project_not_found");

  if (proj.status !== "draft" || proj.bagsConfigKey) {
    throw new Error("fee_share_locked_after_launch_config");
  }

  await destructiveAction(
    {
      actorUserId: ctx.userId,
      permission: "platform.fees.update",
      projectId: proj.id,
      reason: parsed.reason,
      targetName: proj.name,
      typedConfirmation: parsed.typedConfirmation,
      mfaConfirmedAtMs: parsed.mfaConfirmedAtMs,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    },
    {
      action: "fees.update",
      targetType: "project",
      targetId: proj.id,
      metadata: {
        kind: "project_platform_fee_bps",
        previousBps: proj.platformFeeBps,
        bps: parsed.bps,
        contributorPoolBps: 10_000 - parsed.bps,
      },
    },
    async () => {
      await dbHttp
        .update(projects)
        .set({ platformFeeBps: parsed.bps, updatedAt: new Date() })
        .where(eq(projects.id, proj.id));
    },
  );

  revalidatePath(`/admin/projects/${proj.id}`);
  revalidatePath("/admin/fees");
  await updateProjectCaches(proj.id);
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

  await withIdempotency(
    deriveKey("banner", ctx.userId, parsed.visible ? 1 : 0, parsed.message),
    async () => {
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
      return { ok: true } as const;
    },
    { scope: `admin:banner:${ctx.userId}` },
  );

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
    "takeSnapshot",
    "executePayout",
    "expireEscrow",
    "publishKpis",
  ]),
});

export async function retriggerWorkflow(
  input: unknown,
): Promise<{ ok: true; runId?: string }> {
  const parsed = TriggerWorkflowSchema.parse(input);
  const ctx = await requireSession();

  await requirePermission("admin.workflows.inspect", { userId: ctx.userId });

  const run =
    parsed.name === "healthPulse"
      ? await start(healthPulse, [])
      : parsed.name === "indexGithubDeltas"
        ? await start(indexGithubDeltas, [])
        : parsed.name === "takeSnapshot"
          ? await start(takeSnapshot, [])
          : parsed.name === "executePayout"
            ? await start(executePayout, [])
            : parsed.name === "expireEscrow"
              ? await start(expireEscrow, [])
              : await start(publishKpis, []);

  await audit({
    actorUserId: ctx.userId,
    action: "admin.access",
    targetType: "workflow",
    targetId: parsed.name,
    metadata: { kind: "retrigger", runId: run.runId },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return { ok: true, runId: run.runId };
}

// ---------------------------------------------------------------------------
// Snapshot leaderboard helpers
// ---------------------------------------------------------------------------

const RecomputeLeaderboardSchema = z.object({
  projectId: z.string().min(1),
});

export async function recomputeLeaderboard(
  input: unknown,
): Promise<{ ok: true; runId: string }> {
  const parsed = RecomputeLeaderboardSchema.parse(input);
  const ctx = await requireSession();

  await requirePermission("scoring.update", {
    userId: ctx.userId,
    projectId: parsed.projectId,
  });

  const run = await start(computeLeaderboardWorkflow, [parsed.projectId]);

  await audit({
    actorUserId: ctx.userId,
    action: "scoring.update",
    targetType: "project",
    targetId: parsed.projectId,
    metadata: { kind: "recompute_leaderboard", runId: run.runId },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  revalidatePath(`/admin/projects/${parsed.projectId}`);
  await updateProjectCaches(parsed.projectId);
  return { ok: true, runId: run.runId };
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
  await withIdempotency(
    deriveKey(
      "payout-config",
      parsed.projectId,
      ctx.userId,
      JSON.stringify(parsed.payoutConfig),
    ),
    async () => {
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
      return { ok: true } as const;
    },
    { scope: `admin:payout-config:${parsed.projectId}:${ctx.userId}` },
  );
  revalidatePath(`/admin/projects/${parsed.projectId}`);
  await updateProjectCaches(parsed.projectId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Audit CSV export
// ---------------------------------------------------------------------------

const AuditExportSchema = z.object({
  prefix: z.string().optional(),
  targetId: z.string().optional(),
  targetType: z.string().optional(),
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
    targetId: parsed.targetId,
    targetType: parsed.targetType,
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
    metadata: {
      prefix: parsed.prefix ?? null,
      targetId: parsed.targetId ?? null,
      targetType: parsed.targetType ?? null,
      count: rows.length,
    },
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
