import "server-only";
import { audit, type AuditAction, type AuditEntry } from "@/lib/audit";
import { requirePermission, type Permission } from "./permissions";

/**
 * Critical action gate.
 *
 * Per PRD § "Critical action gates" + "Admin & permissions":
 *  - Reason string (min 20 chars) recorded with the audit entry.
 *  - MFA reverify within last 5 minutes (v0: timestamp-only stub; v1.1
 *    enforces TOTP reverify on every call).
 *  - Confirmation modal: caller surfaces a typed-target check; we re-validate
 *    here so server cannot be bypassed by a manipulated client.
 *  - Audit log written BEFORE the action runs (so an action that throws still
 *    leaves a paper trail). On success / failure we emit a follow-up entry.
 *  - Reversibility cosign for irreversible actions: v1.1 — currently a TODO.
 */

export interface DestructiveActionContext {
  actorUserId: string;
  permission: Permission; // checked via requirePermission
  projectId?: string;
  reason: string; // min 20 chars
  targetName: string; // e.g. project name; UI requires user to type this
  typedConfirmation: string; // user-typed value matching targetName
  mfaConfirmedAtMs?: number; // session-stored timestamp; must be < 5min ago
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditPayload {
  action: AuditAction;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export type DestructiveErrorCode =
  | "reason_too_short"
  | "confirmation_mismatch"
  | "mfa_expired";

export class DestructiveActionError extends Error {
  override readonly name = "DestructiveActionError";
  readonly code: DestructiveErrorCode;
  constructor(code: DestructiveErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

const MFA_WINDOW_MS = 5 * 60_000;
const REASON_MIN = 20;

/**
 * Wrap any destructive admin operation. Validation order matches the spec
 * so the cheapest checks fail first and we never leak side-effects.
 */
export async function destructiveAction<T>(
  ctx: DestructiveActionContext,
  payload: AuditPayload,
  fn: () => Promise<T>,
): Promise<T> {
  // 1. Permission re-check (also re-resolves the global role from DB).
  await requirePermission(ctx.permission, {
    userId: ctx.actorUserId,
    projectId: ctx.projectId,
  });

  // 2. Reason length.
  if (!ctx.reason || ctx.reason.trim().length < REASON_MIN) {
    throw new DestructiveActionError(
      "reason_too_short",
      `Reason must be at least ${REASON_MIN} characters.`,
    );
  }

  // 3. Typed-confirmation match (case-sensitive — matches what the UI shows).
  if (ctx.typedConfirmation !== ctx.targetName) {
    throw new DestructiveActionError(
      "confirmation_mismatch",
      "Typed confirmation does not match target.",
    );
  }

  // 4. MFA freshness check.
  // v0: skip if mfaConfirmedAtMs is undefined to avoid blocking when MFA
  // isn't configured yet on the user's account. v1.1 enforces.
  // TODO(v1.1): require ctx.mfaConfirmedAtMs (and a fresh TOTP code on the
  // request) for every destructive call.
  if (ctx.mfaConfirmedAtMs !== undefined) {
    const age = Date.now() - ctx.mfaConfirmedAtMs;
    if (age >= MFA_WINDOW_MS) {
      throw new DestructiveActionError(
        "mfa_expired",
        "MFA confirmation has expired. Please reverify.",
      );
    }
  }

  // 5. Append-only audit BEFORE the action runs.
  const baseEntry: AuditEntry = {
    actorUserId: ctx.actorUserId,
    action: payload.action,
    targetType: payload.targetType,
    targetId: payload.targetId,
    metadata: {
      ...(payload.metadata ?? {}),
      reason: ctx.reason.trim(),
      destructive: true,
      phase: "preflight",
      mfaConfirmedAtMs: ctx.mfaConfirmedAtMs ?? null,
    },
    ip: ctx.ip ?? null,
    userAgent: ctx.userAgent ?? null,
  };
  await audit(baseEntry);

  // TODO(v1.1): write a `pending_admin_action` row (cosign) and bail out
  // when one is required and not yet approved.

  // 6. Execute. On success / failure emit a follow-up entry.
  try {
    const result = await fn();
    await audit({
      ...baseEntry,
      metadata: { ...(baseEntry.metadata ?? {}), phase: "completed" },
    });
    return result;
  } catch (e) {
    const err = e as Error;
    await audit({
      ...baseEntry,
      metadata: {
        ...(baseEntry.metadata ?? {}),
        phase: "failed",
        error: err?.message ?? String(e),
      },
    });
    throw e;
  }
}
