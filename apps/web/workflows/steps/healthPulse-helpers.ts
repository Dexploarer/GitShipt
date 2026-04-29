"use step";

import { dbHttp } from "@/db";
import { platformConfig } from "@/db/schema";
import { sql } from "drizzle-orm";
import { enterDbWorkflowContext } from "@/lib/db-rls";

/**
 * Record a heartbeat into platform_config. Step lives outside the workflow
 * file so its DB imports (postgres, AsyncLocalStorage) don't pollute the
 * workflow sandbox.
 */
export async function recordHeartbeat(): Promise<string> {
  "use step";
  enterDbWorkflowContext("healthPulse:recordHeartbeat");

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
