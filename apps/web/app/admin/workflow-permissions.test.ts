import { describe, expect, it } from "vitest";
import { workflowRetriggerPermission } from "./workflow-permissions";

describe("workflowRetriggerPermission", () => {
  it("requires money-moving permissions for payout and escrow workflows", () => {
    expect(workflowRetriggerPermission("executePayout")).toBe(
      "payouts.trigger",
    );
    expect(workflowRetriggerPermission("expireEscrow")).toBe(
      "platform.maintenance",
    );
    expect(workflowRetriggerPermission("reconcileFunds")).toBe(
      "platform.maintenance",
    );
  });

  it("does not let inspect-only workflow access force snapshots", () => {
    expect(workflowRetriggerPermission("takeSnapshot")).toBe("snapshot.force");
  });

  it("keeps non-money operational workflows inspect-gated", () => {
    expect(workflowRetriggerPermission("healthPulse")).toBe(
      "admin.workflows.inspect",
    );
    expect(workflowRetriggerPermission("indexGithubDeltas")).toBe(
      "admin.workflows.inspect",
    );
    expect(workflowRetriggerPermission("publishKpis")).toBe(
      "admin.workflows.inspect",
    );
  });
});
