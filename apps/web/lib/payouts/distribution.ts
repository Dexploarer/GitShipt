import type { LeaderboardEntry } from "@/db/schema/snapshots";
import type { PayoutConfig, ScoringConfig } from "@/db/schema/projects";
import type { ContributorScoreInputs } from "@/db/schema/contributors";
import { computeRawScore, DEFAULT_WEIGHTS } from "@/lib/scoring/v0";

/**
 * Snapshot-time projection of a contributor row, used to construct
 * deterministic LeaderboardEntry rows for snapshot freezing.
 */
export interface SnapshotContributor {
  id: string;
  ghUserId: string;
  ghUsername: string;
  rank: number;
  score: number;
  inputs: ContributorScoreInputs;
}

/**
 * Build the full leaderboard array that gets frozen into snapshots.leaderboard.
 *
 * - Trusts the order of `contributors` (caller sorts by rank ASC, LIMIT topN).
 * - Annotates each row with `weight = tierWeights[rank-1]`. If the rank
 *   exceeds the tierWeights array length, the weight is 0 (entry is kept
 *   for transparency but receives nothing in distribution).
 */
export function buildLeaderboardEntries(
  contributors: SnapshotContributor[],
  tierWeights: number[],
): LeaderboardEntry[] {
  return contributors.map((c, i) => {
    const idx = c.rank - 1;
    const weight =
      idx >= 0 && idx < tierWeights.length ? (tierWeights[idx] ?? 0) : 0;
    void i;
    return {
      contributorId: c.id,
      ghUsername: c.ghUsername,
      ghUserId: c.ghUserId,
      rank: c.rank,
      score: c.score,
      weight,
      inputs: {
        mergedPRs: c.inputs.mergedPRs,
        commits: c.inputs.commits,
        reviews: c.inputs.reviews,
        issues: c.inputs.issues,
        netLines: c.inputs.netLines,
      },
    };
  });
}

/**
 * Reproducibility helper — recomputes the leaderboard score from raw inputs
 * using the project's scoring weights. Snapshot integrity depends on this
 * being a pure function of (inputs, weights, formulaVersion).
 */
export function recomputeScoreForEntry(
  inputs: ContributorScoreInputs,
  scoringConfig: ScoringConfig,
): number {
  // formulaVersion gate — only v0 is shipped today; v1 falls through to v0
  // until implemented. Keeping the switch keeps determinism honest.
  switch (scoringConfig.formulaVersion) {
    case "v0":
    case "v1":
    default:
      return computeRawScore(inputs, scoringConfig.weights ?? DEFAULT_WEIGHTS);
  }
}

/**
 * Plan row for a single recipient. `walletAddress` is null when the
 * contributor hasn't linked a wallet — that amount goes into escrow.
 */
export interface DistributionPlanRow {
  contributorId: string;
  rank: number;
  weight: number;
  amountLamports: bigint;
  walletAddress: string | null;
}

/**
 * Pure distribution: for each leaderboard entry, amount = floor(claimable * weight).
 * Any rounding remainder is added to the rank-1 entry so the sum exactly equals
 * `claimableLamports`. Entries whose weight is 0 (e.g. rank > tierWeights.length)
 * receive nothing.
 *
 * `walletAddresses` is a map of contributorId -> walletAddress (or undefined).
 * Callers who don't have wallet info yet can pass {} and patch later.
 */
export function computeDistributionPlan(
  leaderboard: ReadonlyArray<LeaderboardEntry>,
  claimableLamports: bigint,
  payoutConfig: PayoutConfig,
  walletAddresses: Readonly<Record<string, string | null | undefined>> = {},
): DistributionPlanRow[] {
  const tierWeights = payoutConfig.tierWeights;
  if (claimableLamports <= 0n || leaderboard.length === 0) {
    return [];
  }
  // Clamp to topN.
  const top = leaderboard.slice(0, Math.max(0, payoutConfig.topN));

  // We do all math in scaled bigints. tierWeights are floats, so represent
  // each weight as parts-per-billion to avoid Number drift on division.
  const SCALE = 1_000_000_000n;
  const weightScaled: bigint[] = top.map((e) => {
    const idx = e.rank - 1;
    const w =
      idx >= 0 && idx < tierWeights.length ? (tierWeights[idx] ?? 0) : 0;
    // Round to nearest scaled unit; Math.round on weight*1e9 is fine since
    // weight is in [0, 1].
    return BigInt(Math.round(Math.max(0, w) * Number(SCALE)));
  });

  const totalWeight = weightScaled.reduce((acc, x) => acc + x, 0n);
  if (totalWeight === 0n) {
    return top.map((e) => ({
      contributorId: e.contributorId,
      rank: e.rank,
      weight: 0,
      amountLamports: 0n,
      walletAddress: walletAddresses[e.contributorId] ?? null,
    }));
  }

  // amount_i = floor(claimable * weightScaled_i / totalWeight)
  const amounts: bigint[] = weightScaled.map(
    (w) => (claimableLamports * w) / totalWeight,
  );
  const distributed = amounts.reduce((acc, x) => acc + x, 0n);
  let remainder = claimableLamports - distributed;
  if (remainder > 0n) {
    // Push remainder onto rank-1 (first non-zero-weight entry).
    const targetIdx = weightScaled.findIndex((w) => w > 0n);
    if (targetIdx >= 0) {
      amounts[targetIdx] = (amounts[targetIdx] ?? 0n) + remainder;
      remainder = 0n;
    }
  }

  return top.map((e, i) => {
    const idx = e.rank - 1;
    const w =
      idx >= 0 && idx < tierWeights.length ? (tierWeights[idx] ?? 0) : 0;
    return {
      contributorId: e.contributorId,
      rank: e.rank,
      weight: w,
      amountLamports: amounts[i] ?? 0n,
      walletAddress: walletAddresses[e.contributorId] ?? null,
    };
  });
}
