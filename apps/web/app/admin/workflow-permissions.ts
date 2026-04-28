import type { Permission } from "@/lib/auth/permissions";

export type AdminWorkflowName =
  | "healthPulse"
  | "indexGithubDeltas"
  | "takeSnapshot"
  | "executePayout"
  | "expireEscrow"
  | "publishKpis";

export function workflowRetriggerPermission(
  workflowName: AdminWorkflowName,
): Permission {
  if (workflowName === "executePayout") return "payouts.trigger";
  if (workflowName === "expireEscrow") return "platform.maintenance";
  if (workflowName === "takeSnapshot") return "snapshot.force";
  return "admin.workflows.inspect";
}
