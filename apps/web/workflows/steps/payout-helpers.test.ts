import type { LeaderboardEntry } from "@/db/schema/snapshots";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    weight: rank === 1 ? 0.7 : 0.3,
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

async function importHelpers(args?: {
  wallets?: Record<string, string | null>;
  treasury?: string;
  cap?: bigint;
}) {
  vi.resetModules();
  vi.doMock("@/db", () => ({
    dbHttp: {},
    dbPool: vi.fn(),
    schema: {},
  }));
  vi.doMock("@/lib/bags/client", () => ({ bags: {} }));
  vi.doMock("@/lib/db-rls", () => ({
    applyDbRlsContext: vi.fn(),
    enterDbWorkflowContext: vi.fn(),
  }));
  vi.doMock("@/lib/env", () => ({
    serverEnv: () => ({
      SOLANA_TREASURY_ADDRESS: args?.treasury,
    }),
    hasCredentials: {
      bags: () => true,
      payoutKey: () => true,
      solana: () => true,
    },
    canLaunchOnBags: () => ({ ok: true }),
    stubsAllowed: () => false,
  }));
  vi.doMock("@/lib/payouts/safety", () => ({
    getCycleCap: vi.fn(async () => args?.cap ?? 1_000n),
    isKillSwitchEnabled: vi.fn(async () => false),
    preflightSafety: vi.fn(async () => ({
      ok: true,
      balance: 1_000n,
    })),
  }));
  vi.doMock("./snapshot-helpers", () => ({
    loadContributorWallets: vi.fn(async () => args?.wallets ?? {}),
  }));

  return await import("./payout-helpers");
}

function snapshotContext(leaderboard: LeaderboardEntry[]) {
  return {
    snapshot: {
      id: "snapshot-1",
      projectId: "project-1",
      snapshotPeriod: "2026-04-28",
      formulaVersion: "v0",
      leaderboard,
      merkleRoot: "root",
      status: "frozen",
      totalFeesLamports: "0",
      takenAtISO: new Date("2026-04-28T00:00:00.000Z").toISOString(),
    },
    project: {
      id: "project-1",
      status: "live",
      tokenMint: "So11111111111111111111111111111111111111112",
      payoutConfig: {
        topN: 2,
        tierWeights: [0.7, 0.3],
        claimThresholdLamports: 0,
      },
      scoringConfig: {
        formulaVersion: "v0" as const,
        windowDays: 30,
        weights: {
          mergedPRs: 1,
          commits: 1,
          reviews: 1,
          issues: 1,
          netLines: 1,
        },
        decay: "linear" as const,
        botBlocklist: [],
        botAllowlist: [],
      },
    },
  };
}

describe("payout helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.doUnmock("@/db");
    vi.doUnmock("@/lib/bags/client");
    vi.doUnmock("@/lib/db-rls");
    vi.doUnmock("@/lib/env");
    vi.doUnmock("@/lib/payouts/safety");
    vi.doUnmock("./snapshot-helpers");
  });

  it("routes automated contributor payouts to treasury before distribution", async () => {
    const { buildPlan } = await importHelpers({
      wallets: { alice: "alice-wallet", bot: null },
      treasury: "treasury-wallet",
    });

    const plan = await buildPlan(
      snapshotContext([entry("alice", 1), entry("bot", 2, "treasury")]),
      "100",
    );

    expect(plan).toEqual([
      expect.objectContaining({
        contributorId: "alice",
        amountLamports: "70",
        walletAddress: "alice-wallet",
      }),
      expect.objectContaining({
        contributorId: "bot",
        amountLamports: "30",
        walletAddress: "treasury-wallet",
      }),
    ]);
  });

  it("fails closed when an automated contributor requires treasury routing without a treasury wallet", async () => {
    const { buildPlan } = await importHelpers({
      wallets: { bot: null },
      treasury: undefined,
    });

    await expect(
      buildPlan(snapshotContext([entry("bot", 1, "treasury")]), "100"),
    ).rejects.toThrow(/treasury_wallet_missing_for_automated_contributor:bot/);
  });

  it("blocks payout cycles above the configured cycle cap", async () => {
    const { assertCycleUnderCap } = await importHelpers({ cap: 99n });

    await expect(
      assertCycleUnderCap([
        {
          contributorId: "alice",
          rank: 1,
          weight: 1,
          amountLamports: "100",
          walletAddress: "alice-wallet",
          idempotencyKey: "idem-1",
        },
      ]),
    ).resolves.toEqual({
      ok: false,
      reason: "cycle_over_cap:total=100,cap=99",
    });
  });
});
