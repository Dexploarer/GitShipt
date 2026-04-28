import type { LeaderboardEntry } from "@/db/schema/snapshots";
import { describe, expect, it } from "vitest";
import { buildBagsFeeShareDistributionPlan } from "./fee-share-distribution";

function entry(
  contributorId: string,
  rank: number,
  payoutRoute?: LeaderboardEntry["payoutRoute"],
): LeaderboardEntry {
  return {
    contributorId,
    ghUsername: contributorId,
    ghUserId: `gh-${contributorId}`,
    rank,
    score: 100 - rank,
    weight: rank === 1 ? 0.5 : rank === 2 ? 0.3 : 0.2,
    payoutRoute,
    inputs: {
      mergedPRs: 0,
      commits: 0,
      reviews: 0,
      issues: 0,
      netLines: 0,
    },
  };
}

const payoutConfig = {
  topN: 3,
  tierWeights: [0.5, 0.3, 0.2],
  claimThresholdLamports: 0,
};

describe("buildBagsFeeShareDistributionPlan", () => {
  it("routes linked contributors directly and unlinked contributors to the pool", () => {
    const plan = buildBagsFeeShareDistributionPlan({
      leaderboard: [entry("alice", 1), entry("bob", 2), entry("carol", 3)],
      payoutConfig,
      walletAddresses: {
        alice: "alice-wallet",
        bob: "bob-wallet",
      },
      platformFeeBps: 500,
      contributorPoolWallet: "pool-wallet",
      treasuryWallet: "treasury-wallet",
    });

    expect(plan).toMatchObject({
      directContributorBps: 7600,
      contributorPoolBps: 1900,
      treasuryBps: 500,
      pooledUnlinkedBps: 1900,
      pooledOverflowBps: 0,
      pooledRoundingBps: 0,
    });
    expect(plan.feeClaimers).toEqual([
      { wallet: "alice-wallet", bps: 4750, role: "contributor" },
      { wallet: "bob-wallet", bps: 2850, role: "contributor" },
      { wallet: "pool-wallet", bps: 1900, role: "contributor_pool" },
      { wallet: "treasury-wallet", bps: 500, role: "treasury" },
    ]);
  });

  it("keeps all contributor fees in the pool when nobody has linked a wallet", () => {
    const plan = buildBagsFeeShareDistributionPlan({
      leaderboard: [entry("alice", 1), entry("bob", 2), entry("carol", 3)],
      payoutConfig,
      walletAddresses: {},
      platformFeeBps: 200,
      contributorPoolWallet: "pool-wallet",
      treasuryWallet: "treasury-wallet",
    });

    expect(plan.feeClaimers).toEqual([
      { wallet: "pool-wallet", bps: 9800, role: "contributor_pool" },
      { wallet: "treasury-wallet", bps: 200, role: "treasury" },
    ]);
    expect(plan.contributorPoolBps).toBe(9800);
  });

  it("routes automated contributor share to treasury", () => {
    const plan = buildBagsFeeShareDistributionPlan({
      leaderboard: [
        entry("alice", 1),
        entry("github-actions[bot]", 2, "treasury"),
      ],
      payoutConfig,
      walletAddresses: {
        alice: "alice-wallet",
        "github-actions[bot]": "bot-wallet",
      },
      platformFeeBps: 500,
      contributorPoolWallet: "pool-wallet",
      treasuryWallet: "treasury-wallet",
    });

    expect(plan.feeClaimers).toEqual([
      { wallet: "alice-wallet", bps: 5937, role: "contributor" },
      { wallet: "treasury-wallet", bps: 4062, role: "treasury" },
      { wallet: "pool-wallet", bps: 1, role: "contributor_pool" },
    ]);
    expect(plan.treasuryBps).toBe(4062);
    expect(plan.pooledRoundingBps).toBe(1);
  });

  it("falls back to the pool when Bags max-claimer slots are exhausted", () => {
    const plan = buildBagsFeeShareDistributionPlan({
      leaderboard: [entry("alice", 1), entry("bob", 2), entry("carol", 3)],
      payoutConfig,
      walletAddresses: {
        alice: "alice-wallet",
        bob: "bob-wallet",
        carol: "carol-wallet",
      },
      platformFeeBps: 500,
      contributorPoolWallet: "pool-wallet",
      treasuryWallet: "treasury-wallet",
      maxClaimers: 3,
    });

    expect(plan.feeClaimers).toEqual([
      { wallet: "alice-wallet", bps: 4750, role: "contributor" },
      { wallet: "pool-wallet", bps: 4750, role: "contributor_pool" },
      { wallet: "treasury-wallet", bps: 500, role: "treasury" },
    ]);
    expect(plan.pooledOverflowBps).toBe(4750);
  });
});
