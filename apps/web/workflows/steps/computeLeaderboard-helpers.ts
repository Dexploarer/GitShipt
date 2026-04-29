import { dbHttp } from "@/db";
import { projects, contributors, platformConfig } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { ScoringConfig } from "@/db/schema/projects";
import type { ContributorScoreInputs } from "@/db/schema/contributors";
import { revalidateProjectCaches } from "@/lib/cache";
import { enterDbWorkflowContext } from "@/lib/db-rls";

export type ContributorRow = {
  id: string;
  inputs: ContributorScoreInputs;
};

export async function heartbeat(): Promise<void> {
  "use step";
  enterDbWorkflowContext("computeLeaderboard:heartbeat");
  const at = new Date().toISOString();
  await dbHttp
    .insert(platformConfig)
    .values({
      key: "heartbeat.leaderboard",
      value: { lastBeatAt: at, source: "computeLeaderboard" },
    })
    .onConflictDoUpdate({
      target: platformConfig.key,
      set: {
        value: sql`excluded.value`,
        updatedAt: sql`now()`,
      },
    });
}

export async function loadScoringConfig(
  projectId: string,
): Promise<ScoringConfig | null> {
  "use step";
  enterDbWorkflowContext("computeLeaderboard:loadScoringConfig");
  const [row] = await dbHttp
    .select({ scoringConfig: projects.scoringConfig })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return row?.scoringConfig ?? null;
}

export async function loadContributors(
  projectId: string,
): Promise<ContributorRow[]> {
  "use step";
  enterDbWorkflowContext("computeLeaderboard:loadContributors");
  const rows = await dbHttp
    .select({
      id: contributors.id,
      inputs: contributors.inputs,
    })
    .from(contributors)
    .where(
      and(
        eq(contributors.projectId, projectId),
        eq(contributors.excluded, "false"),
      ),
    );
  return rows;
}

export async function writeScores(
  updates: Array<{ id: string; score: number }>,
): Promise<void> {
  "use step";
  enterDbWorkflowContext("computeLeaderboard:writeScores");
  if (updates.length === 0) return;
  // Write per-row; for hackathon scale (<=10k contribs/project) this is fine.
  for (const u of updates) {
    await dbHttp
      .update(contributors)
      .set({ score: u.score })
      .where(eq(contributors.id, u.id));
  }
}

export async function assignRanks(projectId: string): Promise<void> {
  "use step";
  enterDbWorkflowContext("computeLeaderboard:assignRanks");
  await dbHttp.execute(sql`
    with ranked as (
      select id, row_number() over (order by score desc) as rk
      from contributors
      where project_id = ${projectId} and excluded = 'false'
    )
    update contributors
    set rank = ranked.rk
    from ranked
    where contributors.id = ranked.id
  `);
}

export async function revalidateProjectCachesStep(
  projectId: string,
): Promise<void> {
  "use step";
  enterDbWorkflowContext("computeLeaderboard:revalidateProjectCaches");
  await revalidateProjectCaches(projectId);
}
