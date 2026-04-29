import {
  acquireLockStep,
  releaseLockStep,
  loadProject,
  loadSinceCursor,
  fetchAndAggregate,
  upsertContributors,
  markCursor,
  startComputeLeaderboardStep,
} from "@/workflows/steps/indexProjectDeltas-helpers";

/**
 * Per-project indexer. Fetches commits + merged PRs since the last
 * incremental sync, upserts contributors, advances the cursor, then
 * triggers `computeLeaderboard`.
 */
export async function indexProjectDeltas(
  projectId: string,
): Promise<{ projectId: string; status: "ok" | "skipped"; reason?: string }> {
  "use workflow";
  const lock = await acquireLockStep("indexProjectDeltas", projectId, 15 * 60);
  if (!lock.acquired) {
    return { projectId, status: "skipped", reason: "already_running" };
  }
  try {
    const project = await loadProject(projectId);
    if (!project) {
      return { projectId, status: "skipped", reason: "not_found" };
    }
    if (!project.ghInstallationId) {
      console.log(
        `[indexProjectDeltas] Skipping ${projectId} (${project.ghOwner}/${project.ghRepo}) — no installation id`,
      );
      return { projectId, status: "skipped", reason: "no_installation" };
    }

    const sinceISO = await loadSinceCursor(projectId, project.scoringConfig);

    const aggregates = await fetchAndAggregate(
      project.ghOwner,
      project.ghRepo,
      project.ghInstallationId,
      sinceISO,
      project.scoringConfig,
    );

    await upsertContributors(projectId, aggregates);
    await markCursor(projectId, new Date().toISOString());

    await startComputeLeaderboardStep(projectId);

    return { projectId, status: "ok" };
  } finally {
    await releaseLockStep(lock);
  }
}
