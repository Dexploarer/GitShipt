import {
  acquireLockStep,
  releaseLockStep,
  heartbeat,
  loadActiveProjects,
  startProjectIndex,
} from "@/workflows/steps/indexGithubDeltas-helpers";

/**
 * Top-level indexer — runs every 15 minutes. Fans out to per-project
 * child workflows. Records a heartbeat so ops dashboards can show
 * "indexer alive".
 */
export async function indexGithubDeltas(): Promise<{ count: number }> {
  "use workflow";
  const lock = await acquireLockStep("indexGithubDeltas", "root", 15 * 60);
  if (!lock.acquired) return { count: 0 };
  try {
    await heartbeat();
    const ids = await loadActiveProjects();
    for (const id of ids) {
      await startProjectIndex(id);
    }
    return { count: ids.length };
  } finally {
    await releaseLockStep(lock);
  }
}
