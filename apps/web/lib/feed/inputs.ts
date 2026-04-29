/**
 * Pure synthesizers — turn raw period inputs (logbook + git history) into
 * the structured payload a feed entry carries.
 *
 * No I/O here. Callers pass in a snapshot row's fields; we return the
 * payload shape stored in `project_feed_entries.subjects`. Testable in
 * isolation; reusable from any workflow step.
 *
 * The "logbook" view of the period is the per-snapshot leaderboard; the
 * "git history" view is the inputs sub-object on each leaderboard entry
 * (mergedPRs, commits, reviews, issues, netLines). We sum + slice here.
 */

import type {
  LeaderboardEntry,
  PeriodDigestSubjects,
} from "@/db/schema";

/** How many top contributors to surface in a digest card. */
export const PERIOD_DIGEST_TOP_N = 5;

/**
 * Synthesize a `period_digest` payload from a frozen snapshot row.
 *
 * @param snapshotId      ID of the snapshots row that triggered this digest.
 * @param snapshotPeriod  YYYY-MM-DD period key from the snapshot.
 * @param leaderboard     The frozen leaderboard JSONB array.
 * @returns PeriodDigestSubjects ready to be written into
 *          project_feed_entries.subjects.
 */
export function buildPeriodDigestSubjects(
  snapshotId: string,
  snapshotPeriod: string,
  leaderboard: ReadonlyArray<LeaderboardEntry>,
): PeriodDigestSubjects {
  // Defensive sort: snapshots typically store leaderboard in rank order,
  // but we don't trust the writer's guarantee.
  const sorted = [...leaderboard].sort((a, b) => a.rank - b.rank);

  const topContributors = sorted
    .slice(0, PERIOD_DIGEST_TOP_N)
    .map((e) => ({
      ghUsername: e.ghUsername,
      rank: e.rank,
      score: e.score,
      weight: e.weight,
      inputs: {
        mergedPRs: e.inputs.mergedPRs,
        commits: e.inputs.commits,
        reviews: e.inputs.reviews,
        issues: e.inputs.issues,
        netLines: e.inputs.netLines,
      },
    }));

  const totals = sorted.reduce(
    (acc, e) => {
      acc.contributors += 1;
      acc.mergedPRs += e.inputs.mergedPRs;
      acc.commits += e.inputs.commits;
      acc.reviews += e.inputs.reviews;
      acc.issues += e.inputs.issues;
      acc.netLines += e.inputs.netLines;
      return acc;
    },
    {
      contributors: 0,
      mergedPRs: 0,
      commits: 0,
      reviews: 0,
      issues: 0,
      netLines: 0,
    },
  );

  return {
    snapshotId,
    topContributors,
    totals,
    period: snapshotPeriod,
  };
}
