export interface PendingAdminApproval {
  ok: false;
  status: "pending_admin_approval";
  pendingActionId: string;
  expiresAt: string;
  message: string;
}

export type AdminActionResult<
  T extends Record<string, unknown> = Record<never, never>,
> = ({ ok: true } & T) | PendingAdminApproval;

export function isPendingAdminApproval(
  value: unknown,
): value is PendingAdminApproval {
  if (!value || typeof value !== "object") return false;

  return (
    "ok" in value &&
    value.ok === false &&
    "status" in value &&
    value.status === "pending_admin_approval" &&
    "pendingActionId" in value &&
    typeof value.pendingActionId === "string" &&
    "expiresAt" in value &&
    typeof value.expiresAt === "string"
  );
}
