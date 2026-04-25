"use workflow";

import { dbHttp } from "@/db";
import { platformConfig } from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * healthPulse — minute-level heartbeat workflow.
 *
 * Updates `platform_config[heartbeat.runtime]` with the current ISO timestamp
 * and a monotonically increasing tick. The Ops dashboard reads this to show
 * "system is alive"; the System Status card on the project page shows green
 * dot if last beat < 2min ago.
 *
 * Idempotency: writes are upserts keyed on a constant key, so retries are safe.
 */
export async function healthPulse(): Promise<{ ok: true; at: string }> {
  const at = await recordHeartbeat();
  return { ok: true, at };
}

async function recordHeartbeat(): Promise<string> {
  "use step";

  const at = new Date().toISOString();
  const value = { lastBeatAt: at, source: "healthPulse" };

  await dbHttp
    .insert(platformConfig)
    .values({ key: "heartbeat.runtime", value })
    .onConflictDoUpdate({
      target: platformConfig.key,
      set: {
        value: sql`excluded.value`,
        updatedAt: sql`now()`,
      },
    });

  return at;
}
