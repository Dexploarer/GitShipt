import { describe, expect, it } from "vitest";
import { isPendingAdminApproval } from "./admin-action-result";

describe("admin action result", () => {
  it("recognizes pending admin approval responses", () => {
    expect(
      isPendingAdminApproval({
        ok: false,
        status: "pending_admin_approval",
        pendingActionId: "paa_123",
        expiresAt: new Date("2026-04-29T00:00:00.000Z").toISOString(),
        message: "Second super_admin approval required.",
      }),
    ).toBe(true);
  });

  it("does not treat generic failures as pending approval", () => {
    expect(
      isPendingAdminApproval({
        ok: false,
        status: "error",
        message: "failed",
      }),
    ).toBe(false);
  });
});
