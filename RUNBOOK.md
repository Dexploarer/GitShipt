# GitShipt Operations Runbook

Audience: on-call operators with admin access to Vercel, Neon, Upstash,
GitHub App settings, and the Bags.fm dashboard.

This runbook is the first place to look when something goes wrong. It
assumes you are in a verified incident channel; do not perform any
destructive action on production data without a second operator
acknowledging.

## Contents

- [Kill switch — halt all trading](#kill-switch)
- [Cron failure triage](#cron-failure-triage)
- [Payout stalled in `claiming` or `distributing`](#payout-stalled)
- [Escrow recovery](#escrow-recovery)
- [Webhook delivery missed](#webhook-delivery-missed)
- [Database recovery](#database-recovery)
- [Secret rotation](#secret-rotation)
- [Cold treasury signing](#cold-treasury-signing)
- [Environment readiness check](#environment-readiness-check)

## Kill switch

Two layers, in order of preference:

1. **`EMERGENCY_KILL_SWITCH=true`** in Vercel env. No DB read; survives a
   DB outage. Set, redeploy, verify `/api/health` shows `overrides.emergencyKillSwitch: true`.
2. **`platform_config.kill_switch.global = { "enabled": true, "reason": "<incident summary>" }`**.
   Validated by Zod; coerced strings (`"yes"`, `1`) are explicitly
   rejected.

To halt only one project, write
`platform_config.kill_switch.projects = { "<projectId>": { "enabled": true } }`.

Both are read by `lib/trading-controls.ts` on every payout / launch /
fee-share entry. A halt is logged via the audit table when the calling
action attempts to proceed and is denied.

## Cron failure triage

Crons run from `vercel.json`:

| Cron | Schedule | Workflow |
|------|----------|----------|
| `/api/cron/index-github`   | every 15 min | `indexGithubDeltas` |
| `/api/cron/snapshot`       | 00:00 UTC daily | `takeSnapshot` |
| `/api/cron/payout`         | 00:30 UTC daily | `executePayout` |
| `/api/cron/reconcile-funds`| every 15 min | `reconcileFunds` |
| `/api/cron/expire-escrow`  | 01:00 UTC daily | `expireEscrow` |
| `/api/cron/health`         | every minute | `healthPulse` |
| `/api/cron/publish-kpis`   | every minute | `publishKpis` |

If a cron fires but does nothing, check in this order:

1. **`CRON_SECRET` mismatch** — a 401 on the route. The compare is
   timing-safe, so the only causes are missing or stale env. Re-set the
   var in Vercel and redeploy.
2. **Workflow lock unavailable** — `lib/workflow-locks.ts` throws
   `WorkflowLockUnavailableError` and emits a fatal `workflow-lock.acquire`
   event. Cause is usually Redis unreachable. Check Upstash status,
   then redeploy.
3. **Duplicate snapshot / payout** — a UNIQUE constraint on
   `(project_id, snapshot_period)` rejected the row. This is intended;
   inspect the existing row before manually intervening.

## Payout stalled

A row is stalled if `payouts.status` is `claiming` or `distributing`
for more than two payout cycles.

1. Check the workflow lock key: `gitshipt:workflow-lock:executePayout:<projectId>`.
   If a stale token holds it, `releaseWorkflowLock` will not free it
   (CAS by token). Wait for TTL or, with a second operator, delete the
   key in Upstash.
2. Inspect `payout_status_events` for the row. The DB trigger requires
   transitions to follow the FSM (`apps/web/lib/payouts/state-transitions.ts`).
3. If the on-chain claim succeeded but distribution did not, the
   `MANUAL_RECONCILIATION_ERROR` sentinel is logged. Use
   `apps/web/workflows/reconcileFunds.ts` (`/api/cron/reconcile-funds`
   already runs this every 15 min) and review
   `fund_reconciliation_runs` for the diagnostic.
4. Never UPDATE `payouts.status` directly. The trigger will reject any
   illegal transition; legal transitions go through
   `assertValidPayoutTransition` first.

## Escrow recovery

Escrow holdings are written when a contributor wallet is missing. Two
recovery paths:

1. **Contributor links a wallet** — `/api/claims/link` followed by
   `/api/claims/escrow` drains the held amount to the wallet under an
   idempotency key derived from the holding id.
2. **Operator-driven sweep** — once `expires_at` passes, `expireEscrow`
   sweeps the holding back to treasury. Trigger early via the admin
   workflows page if needed; the cron runs daily at 01:00 UTC.

## Webhook delivery missed

GitHub will not retry webhooks. Use the GitHub App's "Recent deliveries"
panel to redeliver. Bags.fm webhooks are deduped by their signed body —
replays are safe.

For HMAC verification failures, check that `GITHUB_APP_WEBHOOK_SECRET`
matches the App settings exactly (no trailing newline) and that the
delivery includes `X-Hub-Signature-256`.

## Database recovery

Neon Postgres provides point-in-time recovery for the last 30 days.

1. From the Neon dashboard, create a new branch at the desired timestamp.
2. Run `bun run db:migrate --dry-run` against the new branch to confirm
   schema compatibility.
3. Update `DATABASE_URL` in Vercel to the new branch URL, redeploy.
4. Once verified, archive the old branch.

For non-time-based recovery, restore from the daily snapshot the Neon
plan provides.

## Secret rotation

All secrets are kept in Vercel with the **Sensitive** flag.

Rotate annually, plus immediately on suspected compromise:

| Secret | Notes |
|---|---|
| `BETTER_AUTH_SECRET` | All sessions invalidated on rotation. |
| `CRON_SECRET` | 32+ chars; `openssl rand -base64 32`. |
| `IDEMPOTENCY_KEY_SECRET` | Rotation invalidates the cache; replays of stored entries return `IDEMPOTENCY_REPLAY` until the cache cycles. |
| `GITHUB_APP_PRIVATE_KEY` | Generate from GitHub App settings; old key is revoked. |
| `GITHUB_APP_WEBHOOK_SECRET` | Update GitHub App config in lockstep. |
| `BAGS_API_KEY`, `BAGS_WEBHOOK_SECRET` | Coordinate with Bags.fm to avoid in-flight launch failures. |
| `SOLANA_PAYOUT_KEYPAIR` | Generate, fund the new keypair, drain the old one through reconciliation, then retire. |

## Cold treasury signing

The cold treasury keypair never enters Vercel. Signing is multi-sig and
done from offline hardware:

1. Build the unsigned transaction in the admin treasury page.
2. Export to a hardware-signing host.
3. Two operators co-sign offline.
4. Broadcast via a hot RPC; record the signature in the admin audit
   trail with reason and ticket reference.

Never paste the cold-treasury private key into chat, email, or a Vercel
env variable.

## Environment readiness check

Run from a deployment environment:

```bash
bun run env:check    # productionReadiness() — fails if any required var missing
```

`/api/health` exposes the same readout as JSON, plus per-service
`stubMode` and live override flags (`emergencyKillSwitch`,
`killSwitchEnabled`, `allowStubsInProd`, `allowDemoSeed`,
`allowNonNeonRlsOff`, `bagsAllowProdLaunch`).
