"use workflow";

import { dbHttp } from "@/db";
import { projects, platformConfig } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { start } from "workflow/api";
import { indexProjectDeltas } from "./indexProjectDeltas";
import { enterDbWorkflowContext } from "@/lib/db-rls";

/**
 * Top-level indexer — runs every 15 minutes. Fans out to per-project
 * child workflows. Records a heartbeat so ops dashboards can show
 * "indexer alive".
 */
export async function indexGithubDeltas(): Promise<{ count: number }> {
  await heartbeat();
  const ids = await loadActiveProjects();
  for (const id of ids) {
    await start(indexProjectDeltas, [id]);
  }
  return { count: ids.length };
}

async function heartbeat(): Promise<void> {
  "use step";
  enterDbWorkflowContext("indexGithubDeltas:heartbeat");
  const at = new Date().toISOString();
  await dbHttp
    .insert(platformConfig)
    .values({
      key: "heartbeat.indexer",
      value: { lastBeatAt: at, source: "indexGithubDeltas" },
    })
    .onConflictDoUpdate({
      target: platformConfig.key,
      set: {
        value: sql`excluded.value`,
        updatedAt: sql`now()`,
      },
    });
}

async function loadActiveProjects(): Promise<string[]> {
  "use step";
  enterDbWorkflowContext("indexGithubDeltas:loadActiveProjects");
  const rows = await dbHttp
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.status, "live"));
  return rows.map((r) => r.id);
}
