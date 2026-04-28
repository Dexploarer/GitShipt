import { describe, expect, it } from "vitest";
import type { LeaderboardEntry } from "@/db/schema/snapshots";
import {
  buildLeaderboardEntries,
  computeDistributionPlan,
  type SnapshotContributor,
} from "./distribution";

function leaderboardEntry(
  contributorId: string,
  rank: number,
  weight: number,
): LeaderboardEntry {
  return {
    contributorId,
    ghUsername: `user-${rank}`,
    ghUserId: `gh-${rank}`,
    rank,
    score: 100 - rank,
    weight,
    inputs: {
      mergedPRs: 0,
      commits: 0,
      reviews: 0,
      issues: 0,
      netLines: 0,
    },
  };
}

describe("computeDistributionPlan", () => {
  it("normalizes configured weights and assigns rounding remainder to the first paid rank", () => {
    const plan = computeDistributionPlan(
      [
        leaderboardEntry("c1", 1, 0.5),
        leaderboardEntry("c2", 2, 0.3),
        leaderboardEntry("c3", 3, 0.2),
      ],
      101n,
      {
        topN: 3,
        tierWeights: [0.5, 0.3, 0.2],
        claimThresholdLamports: 0,
      },
      { c1: "wallet-1", c2: "wallet-2" },
    );

    expect(plan.map((row) => row.amountLamports)).toEqual([51n, 30n, 20n]);
    expect(plan.reduce((sum, row) => sum + row.amountLamports, 0n)).toBe(101n);
    expect(plan.map((row) => row.walletAddress)).toEqual([
      "wallet-1",
      "wallet-2",
      null,
    ]);
  });

  it("redistributes all claimed lamports across the paid topN window", () => {
    const plan = computeDistributionPlan(
      [
        leaderboardEntry("c1", 1, 0.5),
        leaderboardEntry("c2", 2, 0.3),
        leaderboardEntry("c3", 3, 0.2),
      ],
      80n,
      {
        topN: 2,
        tierWeights: [0.5, 0.3, 0.2],
        claimThresholdLamports: 0,
      },
    );

    expect(plan).toHaveLength(2);
    expect(plan.map((row) => row.amountLamports)).toEqual([50n, 30n]);
    expect(plan.reduce((sum, row) => sum + row.amountLamports, 0n)).toBe(80n);
  });

  it("does not invent payouts when all eligible weights are zero", () => {
    const plan = computeDistributionPlan(
      [leaderboardEntry("c1", 4, 0), leaderboardEntry("c2", 5, 0)],
      100n,
      {
        topN: 2,
        tierWeights: [0.5, 0.3, 0.2],
        claimThresholdLamports: 0,
      },
      { c1: "wallet-1" },
    );

    expect(plan.map((row) => row.amountLamports)).toEqual([0n, 0n]);
    expect(plan.map((row) => row.walletAddress)).toEqual(["wallet-1", null]);
  });
});

describe("buildLeaderboardEntries", () => {
  it("preserves treasury routing metadata from scored contributors", () => {
    const contributors: SnapshotContributor[] = [
      {
        id: "bot-1",
        ghUserId: "41898282",
        ghUsername: "github-actions[bot]",
        rank: 1,
        score: 10,
        payoutRoute: "treasury",
        payoutRouteReason: "automated_agent",
        inputs: {
          mergedPRs: 1,
          commits: 2,
          reviews: 3,
          issues: 4,
          netLines: 5,
        },
      },
    ];

    expect(buildLeaderboardEntries(contributors, [1])).toEqual([
      expect.objectContaining({
        contributorId: "bot-1",
        weight: 1,
        payoutRoute: "treasury",
        payoutRouteReason: "automated_agent",
      }),
    ]);
  });
});
