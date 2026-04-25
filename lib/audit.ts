import { dbHttp } from "@/db";
import { auditLogs } from "@/db/schema";

export type AuditAction =
  | "auth.signin"
  | "auth.wallet_link"
  | "project.create"
  | "project.launch"
  | "project.pause"
  | "project.kill"
  | "project.delete"
  | "project.transfer"
  | "scoring.update"
  | "payout.trigger"
  | "payout.cancel"
  | "payout.retry"
  | "snapshot.force"
  | "treasury.topup"
  | "fees.update"
  | "kill_switch.toggle"
  | "user.role_grant"
  | "admin.access";

export interface AuditEntry {
  actorUserId: string | null;
  action: AuditAction;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Append-only audit writer. All admin actions and all payouts must call this.
 * The DB role used by the app should NOT have UPDATE/DELETE on `audit_logs`.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  await dbHttp.insert(auditLogs).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    metadata: entry.metadata ?? {},
    ip: entry.ip ?? null,
    userAgent: entry.userAgent ?? null,
  });
}
