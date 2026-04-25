"use workflow";

import { dbHttp } from "@/db";
import { projects, contributors, platformConfig } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { computeRawScore, DEFAULT_WEIGHTS } from "@/lib/scoring/v0";
import type { ScoringConfig } from "@/db/schema/projects";
import type { ContributorScoreInputs } from "@/db/schema/contributors";

/**
 * Recompute scores + ranks for all non-excluded contributors of a project.
 * Score function is pure (lib/scoring/v0). Rank is assigned via SQL window
 * function in a single UPDATE round-trip.
 */
export async function computeLeaderboard(
  projectId: string,
): Promise<{ ranked: number }> {
  await heartbeat();

  const cfg = await loadScoringConfig(projectId);
  if (!cfg) return { ranked: 0 };

  const rows = await loadContributors(projectId);
  const updates = rows.map((r) => ({
    id: r.id,
    score: computeRawScore(r.inputs, cfg.weights ?? DEFAULT_WEIGHTS),
  }));

  await writeScores(updates);
  await assignRanks(projectId);

  return { ranked: updates.length };
}

async function heartbeat(): Promise<void> {
  "use step";
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

async function loadScoringConfig(
  projectId: string,
): Promise<ScoringConfig | null> {
  "use step";
  const [row] = await dbHttp
    .select({ scoringConfig: projects.scoringConfig })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return row?.scoringConfig ?? null;
}

async function loadContributors(
  projectId: string,
): Promise<Array<{ id: string; inputs: ContributorScoreInputs }>> {
  "use step";
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

async function writeScores(
  updates: Array<{ id: string; score: number }>,
): Promise<void> {
  "use step";
  if (updates.length === 0) return;
  // Write per-row; for hackathon scale (<=10k contribs/project) this is fine.
  for (const u of updates) {
    await dbHttp
      .update(contributors)
      .set({ score: u.score })
      .where(eq(contributors.id, u.id));
  }
}

async function assignRanks(projectId: string): Promise<void> {
  "use step";
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
