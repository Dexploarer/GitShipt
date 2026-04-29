/**
 * Payout FSM — pure helper.
 *
 * Mirrors the rule set enforced by the Postgres trigger
 * `payouts_status_guard` (migration 0012). Use this helper at every payout
 * status mutation so the application fails fast (and with a clear error)
 * before the DB rejects the write. Both layers must agree; if you ever
 * change the rule set, update both here AND the trigger.
 *
 * Allowed edges:
 *
 *   pending      -> claiming | cancelled | simulated | failed
 *   claiming     -> distributing | failed | cancelled | completed
 *   distributing -> completed | failed
 *   failed       -> claiming | cancelled | simulated
 *   completed    -> (terminal)
 *   cancelled    -> (terminal)
 *   simulated    -> (terminal)
 */

export type PayoutStatus =
  | "pending"
  | "claiming"
  | "distributing"
  | "completed"
  | "failed"
  | "cancelled"
  | "simulated";

export const ALLOWED_PAYOUT_TRANSITIONS: Record<
  PayoutStatus,
  ReadonlySet<PayoutStatus>
> = {
  pending: new Set(["claiming", "cancelled", "simulated", "failed"]),
  claiming: new Set(["distributing", "failed", "cancelled", "completed"]),
  distributing: new Set(["completed", "failed"]),
  failed: new Set(["claiming", "cancelled", "simulated"]),
  completed: new Set(),
  cancelled: new Set(),
  simulated: new Set(),
};

export class PayoutStatusTransitionError extends Error {
  readonly code = "PAYOUT_STATUS_TRANSITION";
  readonly from: PayoutStatus;
  readonly to: PayoutStatus;
  constructor(from: PayoutStatus, to: PayoutStatus) {
    super(`illegal payout status transition: ${from} -> ${to}`);
    this.name = "PayoutStatusTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function isValidPayoutTransition(
  from: PayoutStatus,
  to: PayoutStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED_PAYOUT_TRANSITIONS[from].has(to);
}

export function assertValidPayoutTransition(
  from: PayoutStatus,
  to: PayoutStatus,
): void {
  if (!isValidPayoutTransition(from, to)) {
    throw new PayoutStatusTransitionError(from, to);
  }
}
