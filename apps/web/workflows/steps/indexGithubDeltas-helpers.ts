import { sql, eq } from "drizzle-orm";
import { start } from "workflow/api";
import { dbHttp } from "@/db";
import { projects, platformConfig } from "@/db/schema";
import { enterDbWorkflowContext } from "@/lib/db-rls";
import {
  acquireWorkflowLock,
  releaseWorkflowLock,
  type WorkflowLock,
} from "@/lib/workflow-locks";
import { indexProjectDeltas } from "../indexProjectDeltas";

export type { WorkflowLock };

export async function acquireLockStep(
  workflowName: string,
  scope: string,
  ttlSeconds: number,
): Promise<WorkflowLock> {
  "use step";
  return await acquireWorkflowLock(workflowName, scope, ttlSeconds);
}

export async function releaseLockStep(lock: WorkflowLock): Promise<void> {
  "use step";
  await releaseWorkflowLock(lock);
}

export async function heartbeat(): Promise<void> {
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

export async function loadActiveProjects(): Promise<string[]> {
  "use step";
  enterDbWorkflowContext("indexGithubDeltas:loadActiveProjects");
  const rows = await dbHttp
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.status, "live"));
  return rows.map((r) => r.id);
}

export async function startProjectIndex(projectId: string): Promise<void> {
  "use step";
  await start(indexProjectDeltas, [projectId]);
}
