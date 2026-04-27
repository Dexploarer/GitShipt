import { beforeEach, describe, expect, it, vi } from "vitest";

const auditMock = vi.fn(async (entry: unknown) => {
  void entry;
});
const requirePermissionMock = vi.fn(async () => undefined);
const getMfaConfirmedAtMock = vi.fn<() => Promise<number | null>>();

vi.mock("server-only", () => ({}));
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
});
