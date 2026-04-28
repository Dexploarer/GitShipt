"use workflow";

import { dbHttp } from "@/db";
import { projects, ghIndexerState, contributors } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { start } from "workflow/api";
import { installationOctokit } from "@/lib/github/app";
import {
  fetchCommitsByAuthor,
  fetchMergedPRsByAuthor,
  fetchRepoContributorsLeaderboard,
  mergeAggregates,
  applyBotFlags,
  type ContributorAggregate,
} from "@/lib/github/indexer";
import type { ScoringConfig } from "@/db/schema/projects";
import { computeLeaderboard } from "./computeLeaderboard";
import { enterDbWorkflowContext } from "@/lib/db-rls";

type LoadedProject = {
  id: string;
  ghOwner: string;
  ghRepo: string;
  ghInstallationId: string | null;
  scoringConfig: ScoringConfig;
};

const TREASURY_ROUTED_AGENT_REASON = "treasury_routed_agent";

/**
 * Per-project indexer. Fetches commits + merged PRs since the last
 * incremental sync, upserts contributors, advances the cursor, then
 * triggers `computeLeaderboard`.
 */
export async function indexProjectDeltas(
  projectId: string,
): Promise<{ projectId: string; status: "ok" | "skipped"; reason?: string }> {
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

  await start(computeLeaderboard, [projectId]);

  return { projectId, status: "ok" };
}

async function loadProject(projectId: string): Promise<LoadedProject | null> {
  "use step";
  enterDbWorkflowContext("indexProjectDeltas:loadProject");
  const [row] = await dbHttp
    .select({
      id: projects.id,
      ghOwner: projects.ghOwner,
      ghRepo: projects.ghRepo,
      ghInstallationId: projects.ghInstallationId,
      scoringConfig: projects.scoringConfig,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return row ?? null;
}

async function loadSinceCursor(
  projectId: string,
  scoringConfig: ScoringConfig,
): Promise<string> {
  "use step";
  enterDbWorkflowContext("indexProjectDeltas:loadSinceCursor");
  const [row] = await dbHttp
    .select({
      lastIncrementalSyncAt: ghIndexerState.lastIncrementalSyncAt,
    })
    .from(ghIndexerState)
    .where(eq(ghIndexerState.projectId, projectId))
    .limit(1);

  if (row?.lastIncrementalSyncAt) {
    return row.lastIncrementalSyncAt.toISOString();
  }
  // Cold start: cover the project's scoring window.
  const days = Math.max(1, scoringConfig.windowDays);
  const since = new Date(Date.now() - days * 86_400_000);
  return since.toISOString();
}

async function fetchAndAggregate(
  ghOwner: string,
  ghRepo: string,
  installationId: string,
  sinceISO: string,
  scoringConfig: ScoringConfig,
): Promise<ContributorAggregate[]> {
  "use step";
  const octo = await installationOctokit(installationId);

  // Get default branch (cheap call).
  const repoInfo = await octo.rest.repos.get({ owner: ghOwner, repo: ghRepo });
  const defaultBranch = repoInfo.data.default_branch;

  const [commitsMap, prsMap] = await Promise.all([
    fetchCommitsByAuthor(octo, ghOwner, ghRepo, sinceISO, defaultBranch),
    fetchMergedPRsByAuthor(octo, ghOwner, ghRepo, sinceISO),
  ]);

  let merged = mergeAggregates(commitsMap, prsMap);
  if (merged.length === 0) {
    const fallbackMap = await fetchRepoContributorsLeaderboard(
      octo,
      ghOwner,
      ghRepo,
    );
    merged = mergeAggregates(fallbackMap);
  }
  return applyBotFlags(
    merged,
    scoringConfig.botAllowlist,
    scoringConfig.botBlocklist,
  );
}

async function upsertContributors(
  projectId: string,
  aggregates: ContributorAggregate[],
): Promise<{ count: number }> {
  "use step";
  enterDbWorkflowContext("indexProjectDeltas:upsertContributors");
  if (aggregates.length === 0) return { count: 0 };

  const now = new Date();
  const rows = aggregates.map((a) => ({
    projectId,
    ghUserId: a.ghUserId,
    ghUsername: a.ghUsername,
    avatarUrl: a.avatarUrl,
    inputs: a.inputs,
    excluded: "false",
    excludedReason: a.isBot ? TREASURY_ROUTED_AGENT_REASON : null,
    lastIndexedAt: now,
  }));

  await dbHttp
    .insert(contributors)
    .values(rows)
    .onConflictDoUpdate({
      target: [contributors.projectId, contributors.ghUserId],
      set: {
        ghUsername: sql`excluded.gh_username`,
        avatarUrl: sql`excluded.avatar_url`,
        inputs: sql`excluded.inputs`,
        excluded: sql`excluded.excluded`,
        excludedReason: sql`excluded.excluded_reason`,
        lastIndexedAt: sql`excluded.last_indexed_at`,
      },
    });

  return { count: aggregates.length };
}

async function markCursor(projectId: string, atISO: string): Promise<void> {
  "use step";
  enterDbWorkflowContext("indexProjectDeltas:markCursor");
  const at = new Date(atISO);
  await dbHttp
    .insert(ghIndexerState)
    .values({
      projectId,
      lastIncrementalSyncAt: at,
      updatedAt: at,
    })
    .onConflictDoUpdate({
      target: ghIndexerState.projectId,
      set: {
        lastIncrementalSyncAt: at,
        updatedAt: at,
      },
    });
}
