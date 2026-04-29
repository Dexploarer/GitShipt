import { computeRawScore, DEFAULT_WEIGHTS } from "@/lib/scoring/v0";
import {
  heartbeat,
  loadScoringConfig,
  loadContributors,
  writeScores,
  assignRanks,
  revalidateProjectCachesStep,
} from "@/workflows/steps/computeLeaderboard-helpers";

/**
 * Recompute scores + ranks for all non-excluded contributors of a project.
 * Score function is pure (lib/scoring/v0). Rank is assigned via SQL window
 * function in a single UPDATE round-trip.
 */
export async function computeLeaderboard(
  projectId: string,
): Promise<{ ranked: number }> {
  "use workflow";
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
  await revalidateProjectCachesStep(projectId);

  return { ranked: updates.length };
}
