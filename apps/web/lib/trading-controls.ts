import "server-only";
import { eq } from "drizzle-orm";
import { dbHttp } from "@/db";
import { platformConfig } from "@/db/schema";

type ProjectKillSwitchValue = Record<
  string,
  { enabled?: unknown; reason?: unknown }
>;

export type TradingHalt =
  | { halted: false }
  | { halted: true; scope: "global" | "project"; reason: string | null };

function reasonString(reason: unknown): string | null {
  return typeof reason === "string" && reason.trim()
    ? reason.trim().slice(0, 500)
    : null;
}

export async function tradingHalt(projectId: string): Promise<TradingHalt> {
  const rows = await dbHttp
    .select({ key: platformConfig.key, value: platformConfig.value })
    .from(platformConfig)
    .where(eq(platformConfig.key, "kill_switch.global"))
    .limit(1);

  const global = rows[0]?.value;
  if (global?.enabled === true) {
    return {
      halted: true,
      scope: "global",
      reason: reasonString(global.reason),
    };
  }

  const projectRows = await dbHttp
    .select({ value: platformConfig.value })
    .from(platformConfig)
    .where(eq(platformConfig.key, "kill_switch.projects"))
    .limit(1);
  const value = projectRows[0]?.value as ProjectKillSwitchValue | undefined;
  const project = value?.[projectId];
  if (project?.enabled === true) {
    return {
      halted: true,
      scope: "project",
      reason: reasonString(project.reason),
    };
  }

  return { halted: false };
}
