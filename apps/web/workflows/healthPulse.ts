import { recordHeartbeat } from "@/workflows/steps/healthPulse-helpers";

/**
 * healthPulse — minute-level heartbeat workflow.
 *
 * Updates `platform_config[heartbeat.runtime]` with the current ISO timestamp
 * via the `recordHeartbeat` step. The Ops dashboard reads this to show
 * "system is alive"; the System Status card on the project page shows green
 * dot if last beat < 2min ago.
 *
 * Idempotency: writes are upserts keyed on a constant key, so retries are safe.
 */
export async function healthPulse(): Promise<{ ok: true; at: string }> {
  "use workflow";
  const at = await recordHeartbeat();
  return { ok: true, at };
}
