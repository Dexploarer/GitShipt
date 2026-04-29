import { beforeEach, describe, expect, it, vi } from "vitest";

const auditMock = vi.fn(async (entry: unknown) => {
  void entry;
});
const requirePermissionMock = vi.fn(async () => undefined);
const getMfaConfirmedAtMock = vi.fn<() => Promise<number | null>>();
const selectResults: unknown[][] = [];
const insertResults: unknown[][] = [];
const updateResults: unknown[][] = [];
const insertValuesMock = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  eq: vi.fn((left: unknown, right: unknown) => ({ op: "eq", left, right })),
  isNull: vi.fn((value: unknown) => ({ op: "isNull", value })),
}));
vi.mock("@/db/schema", () => ({
  pendingAdminActions: {
    id: "pending_admin_actions.id",
    fingerprint: "pending_admin_actions.fingerprint",
    idempotencyKey: "pending_admin_actions.idempotency_key",
    status: "pending_admin_actions.status",
    action: "pending_admin_actions.action",
    permission: "pending_admin_actions.permission",
    targetType: "pending_admin_actions.target_type",
    targetId: "pending_admin_actions.target_id",
    projectId: "pending_admin_actions.project_id",
    actorUserId: "pending_admin_actions.actor_user_id",
    approverUserId: "pending_admin_actions.approver_user_id",
    reason: "pending_admin_actions.reason",
    targetName: "pending_admin_actions.target_name",
    payload: "pending_admin_actions.payload",
    expiresAt: "pending_admin_actions.expires_at",
    approvedAt: "pending_admin_actions.approved_at",
    completedAt: "pending_admin_actions.completed_at",
    failedAt: "pending_admin_actions.failed_at",
    failureReason: "pending_admin_actions.failure_reason",
    createdAt: "pending_admin_actions.created_at",
    updatedAt: "pending_admin_actions.updated_at",
  },
  users: {
    id: "users.id",
    role: "users.role",
  },
}));
vi.mock("@/db", () => ({
  dbHttp: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => selectResults.shift() ?? []),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        insertValuesMock(values);
        return {
          returning: vi.fn(async () => insertResults.shift() ?? []),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => updateResults.shift() ?? []),
        })),
      })),
    })),
  },
}));
vi.mock("@/lib/audit", () => ({
  audit: auditMock,
}));
vi.mock("./permissions", () => ({
  requirePermission: requirePermissionMock,
}));
vi.mock("./mfa", () => ({
  getMfaConfirmedAt: getMfaConfirmedAtMock,
}));

describe("destructiveAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    insertResults.length = 0;
    updateResults.length = 0;
  });

  it("rejects when MFA was not confirmed server-side", async () => {
    getMfaConfirmedAtMock.mockResolvedValue(null);
    const { destructiveAction, MfaRequiredError } =
      await import("./destructive-action");

    await expect(
      destructiveAction(
        {
          actorUserId: "user_1",
          permission: "platform.fees.update",
          reason: "Need to rotate the platform fee for launch readiness.",
          targetName: "platform.fees.bps",
          typedConfirmation: "platform.fees.bps",
          mfaConfirmedAtMs: Date.now(),
        },
        {
          action: "fees.update",
          targetType: "platform_config",
          targetId: "fees.platform_bps",
        },
        async () => ({ ok: true }),
      ),
    ).rejects.toBeInstanceOf(MfaRequiredError);

    expect(requirePermissionMock).toHaveBeenCalledOnce();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("audits the server-confirmed MFA timestamp, not the client value", async () => {
    const serverConfirmedAt = Date.now() - 1_000;
    getMfaConfirmedAtMock.mockResolvedValue(serverConfirmedAt);
    const { destructiveAction } = await import("./destructive-action");
    const fn = vi.fn(async () => ({ ok: true }));

    await expect(
      destructiveAction(
        {
          actorUserId: "user_1",
          permission: "platform.fees.update",
          reason: "Need to rotate the platform fee for launch readiness.",
          targetName: "platform.fees.bps",
          typedConfirmation: "platform.fees.bps",
          mfaConfirmedAtMs: Date.now() + 60_000,
        },
        {
          action: "fees.update",
          targetType: "platform_config",
          targetId: "fees.platform_bps",
        },
        fn,
      ),
    ).resolves.toEqual({ ok: true });

    expect(fn).toHaveBeenCalledOnce();
    expect(auditMock).toHaveBeenCalledTimes(2);
    expect(auditMock.mock.calls[0]?.[0]).toMatchObject({
      metadata: {
        phase: "preflight",
        mfaConfirmedAtMs: serverConfirmedAt,
      },
    });
  });

  it("rejects typed-confirmation mismatches before MFA and side effects", async () => {
    const { destructiveAction } = await import("./destructive-action");
    const fn = vi.fn(async () => ({ ok: true }));

    await expect(
      destructiveAction(
        {
          actorUserId: "user_1",
          permission: "project.delete",
          projectId: "project_1",
          reason: "Operator requested deletion after repository transfer.",
          targetName: "SYMBaiEX/gitshipt",
          typedConfirmation: "symbiex/gitshipt",
          mfaConfirmedAtMs: Date.now(),
        },
        {
          action: "project.delete",
          targetType: "project",
          targetId: "project_1",
        },
        fn,
      ),
    ).rejects.toMatchObject({
      code: "confirmation_mismatch",
    });

    expect(requirePermissionMock).toHaveBeenCalledOnce();
    expect(getMfaConfirmedAtMock).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("rejects stale server-confirmed MFA before auditing", async () => {
    getMfaConfirmedAtMock.mockResolvedValue(Date.now() - 5 * 60_000);
    const { destructiveAction } = await import("./destructive-action");
    const fn = vi.fn(async () => ({ ok: true }));

    await expect(
      destructiveAction(
        {
          actorUserId: "user_1",
          permission: "platform.kill_switch",
          reason: "Incident response requires stopping payouts immediately.",
          targetName: "platform.kill_switch",
          typedConfirmation: "platform.kill_switch",
          mfaConfirmedAtMs: Date.now(),
        },
        {
          action: "admin.access",
          targetType: "platform_config",
          targetId: "kill_switch.global",
        },
        fn,
      ),
    ).rejects.toMatchObject({
      code: "mfa_expired",
    });

    expect(requirePermissionMock).toHaveBeenCalledOnce();
    expect(fn).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("parks irreversible actions for second super-admin approval", async () => {
    const serverConfirmedAt = Date.now() - 1_000;
    const expiresAt = new Date(Date.now() + 60 * 60_000);
    getMfaConfirmedAtMock.mockResolvedValue(serverConfirmedAt);
    selectResults.push([]);
    insertResults.push([{ id: "pending_1", expiresAt }]);
    const { destructiveAction, PendingAdminActionError } =
      await import("./destructive-action");
    const fn = vi.fn(async () => ({ ok: true }));

    await expect(
      destructiveAction(
        {
          actorUserId: "super_1",
          permission: "project.kill",
          projectId: "project_1",
          reason: "Incident response requires killing this project now.",
          targetName: "GitShipt",
          typedConfirmation: "GitShipt",
          cosign: {
            required: true,
            idempotencyKey: "kill:project_1:super_1",
          },
        },
        {
          action: "project.kill",
          targetType: "project",
          targetId: "project_1",
        },
        fn,
      ),
    ).rejects.toBeInstanceOf(PendingAdminActionError);

    expect(fn).not.toHaveBeenCalled();
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "super_1",
        targetId: "project_1",
      }),
    );
    expect(auditMock).toHaveBeenCalledTimes(2);
    expect(auditMock.mock.calls[1]?.[0]).toMatchObject({
      metadata: {
        phase: "approval_requested",
        pendingActionId: "pending_1",
      },
    });
  });

  it("executes an irreversible action after a different super-admin approves", async () => {
    const serverConfirmedAt = Date.now() - 1_000;
    const expiresAt = new Date(Date.now() + 60 * 60_000);
    getMfaConfirmedAtMock.mockResolvedValue(serverConfirmedAt);
    selectResults.push([]);
    insertResults.push([{ id: "pending_1", expiresAt }]);
    const { destructiveAction, PendingAdminActionError } =
      await import("./destructive-action");
    const payload = {
      action: "payout.cancel" as const,
      targetType: "payout",
      targetId: "payout_1",
      metadata: { previousStatus: "claiming" },
    };
    const requesterCtx = {
      actorUserId: "super_1",
      permission: "payouts.cancel" as const,
      projectId: "project_1",
      reason: "On-chain claim stalled and payout needs operator review.",
      targetName: "payout_1",
      typedConfirmation: "payout_1",
      cosign: {
        required: true as const,
        idempotencyKey: "cancel:payout_1:super_1",
      },
    };

    await expect(
      destructiveAction(requesterCtx, payload, async () => ({ ok: true })),
    ).rejects.toBeInstanceOf(PendingAdminActionError);

    const created = insertValuesMock.mock.calls[0]?.[0] as {
      fingerprint: string;
    };
    vi.clearAllMocks();
    selectResults.push([
      {
        id: "pending_1",
        actorUserId: "super_1",
        approverUserId: null,
        idempotencyKey: "cancel:payout_1:super_1",
        status: "pending",
        fingerprint: created.fingerprint,
        expiresAt,
      },
    ]);
    selectResults.push([{ role: "super_admin" }]);
    updateResults.push([
      {
        id: "pending_1",
        actorUserId: "super_1",
        approverUserId: "super_2",
        idempotencyKey: "cancel:payout_1:super_1",
      },
    ]);
    const fn = vi.fn(async () => ({ ok: true }));

    await expect(
      destructiveAction(
        {
          ...requesterCtx,
          actorUserId: "super_2",
          reason: "Second operator reviewed the payout and approves cancel.",
          cosign: {
            required: true,
            idempotencyKey: "cancel:payout_1:super_2",
            pendingActionId: "pending_1",
          },
        },
        payload,
        fn,
      ),
    ).resolves.toEqual({ ok: true });

    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith({
      idempotencyKey: "cancel:payout_1:super_1",
    });
    expect(auditMock.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metadata: expect.objectContaining({ phase: "preflight" }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            phase: "approved",
            pendingActionId: "pending_1",
            requestedBy: "super_1",
            approvedBy: "super_2",
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            phase: "completed",
            pendingActionId: "pending_1",
            approvedBy: "super_2",
          }),
        }),
      ]),
    );
  });

  it("rejects irreversible self-approval before side effects", async () => {
    const serverConfirmedAt = Date.now() - 1_000;
    const expiresAt = new Date(Date.now() + 60 * 60_000);
    getMfaConfirmedAtMock.mockResolvedValue(serverConfirmedAt);
    selectResults.push([]);
    insertResults.push([{ id: "pending_1", expiresAt }]);
    const { destructiveAction } = await import("./destructive-action");
    const payload = {
      action: "project.kill" as const,
      targetType: "project",
      targetId: "project_1",
    };
    const ctx = {
      actorUserId: "super_1",
      permission: "project.kill" as const,
      projectId: "project_1",
      reason: "Incident response requires killing this project now.",
      targetName: "GitShipt",
      typedConfirmation: "GitShipt",
      cosign: {
        required: true as const,
        idempotencyKey: "kill:project_1:super_1",
      },
    };

    await expect(
      destructiveAction(ctx, payload, async () => ({ ok: true })),
    ).rejects.toMatchObject({ code: "cosign_required" });
    const created = insertValuesMock.mock.calls[0]?.[0] as {
      fingerprint: string;
    };
    selectResults.push([
      {
        id: "pending_1",
        actorUserId: "super_1",
        approverUserId: null,
        idempotencyKey: "kill:project_1:super_1",
        status: "pending",
        fingerprint: created.fingerprint,
        expiresAt,
      },
    ]);
    const fn = vi.fn(async () => ({ ok: true }));

    await expect(
      destructiveAction(
        {
          ...ctx,
          cosign: {
            required: true,
            idempotencyKey: "kill:project_1:super_1",
            pendingActionId: "pending_1",
          },
        },
        payload,
        fn,
      ),
    ).rejects.toMatchObject({ code: "cosign_self_approval" });

    expect(fn).not.toHaveBeenCalled();
  });

  it("resumes an approved pending action after an execution crash", async () => {
    const serverConfirmedAt = Date.now() - 1_000;
    const expiresAt = new Date(Date.now() + 60 * 60_000);
    getMfaConfirmedAtMock.mockResolvedValue(serverConfirmedAt);
    selectResults.push([]);
    insertResults.push([{ id: "pending_1", expiresAt }]);
    const { destructiveAction, PendingAdminActionError } =
      await import("./destructive-action");
    const payload = {
      action: "project.kill" as const,
      targetType: "project",
      targetId: "project_1",
    };
    const requestCtx = {
      actorUserId: "super_1",
      permission: "project.kill" as const,
      projectId: "project_1",
      reason: "Incident response requires killing this project now.",
      targetName: "GitShipt",
      typedConfirmation: "GitShipt",
      cosign: {
        required: true as const,
        idempotencyKey: "kill:project_1:super_1",
      },
    };
    await expect(
      destructiveAction(requestCtx, payload, async () => ({ ok: true })),
    ).rejects.toBeInstanceOf(PendingAdminActionError);

    const created = insertValuesMock.mock.calls[0]?.[0] as {
      fingerprint: string;
    };
    vi.clearAllMocks();
    selectResults.push([
      {
        id: "pending_1",
        actorUserId: "super_1",
        approverUserId: "super_2",
        idempotencyKey: "kill:project_1:super_1",
        status: "pending",
        fingerprint: created.fingerprint,
        expiresAt,
      },
    ]);
    selectResults.push([{ role: "super_admin" }]);
    const fn = vi.fn(async () => ({ ok: true }));

    await expect(
      destructiveAction(
        {
          actorUserId: "super_2",
          permission: "project.kill",
          projectId: "project_1",
          reason: "Retrying execution after the prior approved run crashed.",
          targetName: "GitShipt",
          typedConfirmation: "GitShipt",
          cosign: {
            required: true,
            idempotencyKey: "kill:project_1:super_2:retry",
            pendingActionId: "pending_1",
          },
        },
        payload,
        fn,
      ),
    ).resolves.toEqual({ ok: true });

    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith({
      idempotencyKey: "kill:project_1:super_1",
    });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          phase: "approval_resumed",
          pendingActionId: "pending_1",
          requestedBy: "super_1",
          approvedBy: "super_2",
        }),
      }),
    );
  });
});
