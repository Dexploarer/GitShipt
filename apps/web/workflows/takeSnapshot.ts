"use workflow";

import { FatalError } from "workflow";
import { start } from "workflow/api";
import { dbHttp } from "@/db";
import { platformConfig } from "@/db/schema";
import { sql } from "drizzle-orm";
import {
  loadEligibleProjectIds,
  loadProjectForSnapshot,
  loadRankedContributors,
  freezeSnapshot,
  buildLeaderboardEntries,
} from "./steps/snapshot-helpers";
import { isKillSwitchEnabled } from "@/lib/payouts/safety";
import { revalidateProjectCaches } from "@/lib/cache";
import { enterDbWorkflowContext } from "@/lib/db-rls";

/**
 * takeSnapshot — daily root, 00:00 UTC.
 *
 * Reads kill switch, writes a heartbeat, and fans out a child workflow per
 * eligible (live + has ranked contributors) project.
 */
export async function takeSnapshot(): Promise<{ count: number }> {
  await assertNotKilled();
  await heartbeat("snapshot");
  const projectIds = await loadEligibleProjectIdsStep();
  for (const id of projectIds) {
    await start(takeProjectSnapshot, [id]);
  }
  return { count: projectIds.length };
}

/**
 * Per-project snapshot freeze. Idempotent by (projectId, UTC day): the
 * snapshot table owns the period uniqueness, and freezeSnapshot returns the
 * existing active period row when a cron/manual retry races.
 */
export async function takeProjectSnapshot(projectId: string): Promise<{
  snapshotId: string;
  count: number;
}> {
  const project = await loadProjectStep(projectId);
  if (!project) return { snapshotId: "", count: 0 };

  const contributors = await loadContributorsStep(
    projectId,
    project.payoutConfig.topN,
  );
  if (contributors.length === 0) return { snapshotId: "", count: 0 };

  const leaderboard = buildLeaderboardEntries(
    contributors,
    project.payoutConfig.tierWeights,
  );

  const result = await freezeStep({
    projectId,
    formulaVersion: project.scoringConfig.formulaVersion,
    leaderboard,
  });
  await revalidateProjectCachesStep(projectId);

  return { snapshotId: result.snapshotId, count: result.leaderboardCount };
}

// ============================================================
// Steps
// ============================================================

async function assertNotKilled(): Promise<void> {
  "use step";
  enterDbWorkflowContext("takeSnapshot:assertNotKilled");
  const killed = await isKillSwitchEnabled();
  if (killed) {
    throw new FatalError("kill_switch_enabled: takeSnapshot aborted");
  }
}

async function heartbeat(name: string): Promise<void> {
  "use step";
  enterDbWorkflowContext("takeSnapshot:heartbeat");
  const at = new Date().toISOString();
  await dbHttp
    .insert(platformConfig)
    .values({
      key: `heartbeat.${name}`,
      value: { lastBeatAt: at, source: "takeSnapshot" },
    })
    .onConflictDoUpdate({
      target: platformConfig.key,
      set: {
        value: sql`excluded.value`,
        updatedAt: sql`now()`,
      },
    });
}

async function loadEligibleProjectIdsStep(): Promise<string[]> {
  "use step";
  enterDbWorkflowContext("takeSnapshot:loadEligibleProjectIds");
  return await loadEligibleProjectIds();
}

async function loadProjectStep(
  projectId: string,
): ReturnType<typeof loadProjectForSnapshot> {
  "use step";
  enterDbWorkflowContext("takeSnapshot:loadProject");
  return await loadProjectForSnapshot(projectId);
}

async function loadContributorsStep(
  projectId: string,
  topN: number,
): ReturnType<typeof loadRankedContributors> {
  "use step";
  enterDbWorkflowContext("takeSnapshot:loadContributors");
  return await loadRankedContributors(projectId, topN);
}

async function freezeStep(
  args: Parameters<typeof freezeSnapshot>[0],
): ReturnType<typeof freezeSnapshot> {
  "use step";
  enterDbWorkflowContext("takeSnapshot:freeze");
  return await freezeSnapshot(args);
}

async function revalidateProjectCachesStep(projectId: string): Promise<void> {
  "use step";
  enterDbWorkflowContext("takeSnapshot:revalidateProjectCaches");
  await revalidateProjectCaches(projectId);
}
