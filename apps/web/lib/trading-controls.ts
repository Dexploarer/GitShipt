import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { dbHttp } from "@/db";
import { platformConfig } from "@/db/schema";
import { serverEnv } from "@/lib/env";

export type TradingHalt =
  | { halted: false }
  | {
      halted: true;
      scope: "global" | "project" | "env" | "db-error";
      reason: string | null;
    };

const killSwitchSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().trim().max(500).nullish(),
});

const projectKillSwitchSchema = z.record(z.string(), killSwitchSchema);

function readReason(parsed: { reason?: string | null }): string | null {
  return parsed.reason ? parsed.reason.slice(0, 500) : null;
}

/**
 * Returns whether trading is halted for the given project.
 *
 * The check is layered so that a single failure mode cannot bypass the halt:
 *
 *   1. EMERGENCY_KILL_SWITCH env var — does not require a DB read. Use during
 *      incidents when the DB itself may be unhealthy.
 *   2. KILL_SWITCH_ENABLED env var — same, but reflects the long-lived
 *      "platform off" config flag rather than an emergency override.
 *   3. platform_config.kill_switch.global  — Zod-validated boolean.
 *   4. platform_config.kill_switch.projects[projectId] — Zod-validated.
 *   5. Any DB error => fail closed (halted) in production. This trades
 *      operational availability for correctness in the money path.
 *
 * Rejecting truthy non-boolean values closes a coercion bypass: an attacker
 * with admin write to platform_config cannot smuggle `enabled: "yes"` to
 * defeat the halt.
 */
export async function tradingHalt(projectId: string): Promise<TradingHalt> {
  const env = serverEnv();
  if (env.EMERGENCY_KILL_SWITCH) {
    return {
      halted: true,
      scope: "env",
      reason: "EMERGENCY_KILL_SWITCH=true",
    };
  }
  if (env.KILL_SWITCH_ENABLED) {
    return {
      halted: true,
      scope: "env",
      reason: "KILL_SWITCH_ENABLED=true",
    };
  }

  let globalValue: unknown;
  let projectValue: unknown;
  try {
    const [globalRows, projectRows] = await Promise.all([
      dbHttp
        .select({ value: platformConfig.value })
        .from(platformConfig)
        .where(eq(platformConfig.key, "kill_switch.global"))
        .limit(1),
      dbHttp
        .select({ value: platformConfig.value })
        .from(platformConfig)
        .where(eq(platformConfig.key, "kill_switch.projects"))
        .limit(1),
    ]);
    globalValue = globalRows[0]?.value;
    projectValue = projectRows[0]?.value;
  } catch (err) {
    // In production, fail closed. In dev/test, surface the error so the
    // operator notices.
    if (env.NODE_ENV === "production") {
      return {
        halted: true,
        scope: "db-error",
        reason: err instanceof Error ? err.message.slice(0, 500) : "DB error",
      };
    }
    throw err;
  }

  if (globalValue !== undefined && globalValue !== null) {
    const parsed = killSwitchSchema.safeParse(globalValue);
    if (!parsed.success) {
      // Malformed payload — refuse to interpret. In production, treat as
      // halted; in dev, throw so the operator notices the bad row.
      if (env.NODE_ENV === "production") {
        return {
          halted: true,
          scope: "global",
          reason: "kill_switch.global payload failed validation",
        };
      }
      throw new Error(
        `kill_switch.global payload failed Zod validation: ${parsed.error.message}`,
      );
    }
    if (parsed.data.enabled) {
      return {
        halted: true,
        scope: "global",
        reason: readReason(parsed.data),
      };
    }
  }

  if (projectValue !== undefined && projectValue !== null) {
    const parsed = projectKillSwitchSchema.safeParse(projectValue);
    if (!parsed.success) {
      if (env.NODE_ENV === "production") {
        return {
          halted: true,
          scope: "project",
          reason: "kill_switch.projects payload failed validation",
        };
      }
      throw new Error(
        `kill_switch.projects payload failed Zod validation: ${parsed.error.message}`,
      );
    }
    const entry = parsed.data[projectId];
    if (entry?.enabled) {
      return {
        halted: true,
        scope: "project",
        reason: readReason(entry),
      };
    }
  }

  return { halted: false };
}
