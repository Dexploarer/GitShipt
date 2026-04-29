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

function sqlText(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];
  return chunks
    .map((chunk) => {
      if (typeof chunk === "string") return chunk;
      const value = (chunk as { value?: unknown }).value;
      return Array.isArray(value) ? value.join("") : "";
    })
    .join("");
}

async function importHelpers(args?: {
  wallets?: Record<string, string | null>;
  treasury?: string;
  cap?: bigint;
  bagsClient?: Record<string, unknown>;
  confirmTransaction?: (signature: string) => Promise<unknown>;
  dbHttp?: Record<string, unknown>;
  dbPool?: () => unknown;
}) {
  vi.resetModules();
  vi.doMock("@/db", () => ({
    dbHttp: args?.dbHttp ?? {},
    dbPool: args?.dbPool ?? vi.fn(),
    schema: {},
  }));
  vi.doMock("@/lib/bags/client", () => ({ bags: args?.bagsClient ?? {} }));
  vi.doMock("@/lib/solana/connection", () => ({
    solanaConnection: vi.fn(() => ({
      confirmTransaction:
        args?.confirmTransaction ?? vi.fn(async () => ({ value: null })),
    })),
  }));
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
    vi.doUnmock("@/lib/solana/connection");
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

  it("loads new frozen snapshots and retry-reserved payout rows for payout execution", async () => {
    const executedSql: string[] = [];
    const dbHttp = {
      execute: vi.fn(async (query: unknown) => {
        executedSql.push(sqlText(query));
        return { rows: [{ id: "snapshot-1" }, { id: "snapshot-retry" }] };
      }),
    };
    const { loadFrozenSnapshotsAwaitingPayout } = await importHelpers({
      dbHttp,
    });

    await expect(loadFrozenSnapshotsAwaitingPayout()).resolves.toEqual([
      { id: "snapshot-1" },
      { id: "snapshot-retry" },
    ]);

    expect(executedSql[0]).toContain("p.id is null");
    expect(executedSql[0]).toContain("p.status in ('pending', 'claiming')");
    expect(executedSql[0]).toContain("p.claim_signature is null");
    expect(executedSql[0]).toContain("p.last_error not like");
  });

  it("marks ambiguous Bags claim failures for manual reconciliation with known signatures", async () => {
    const { Transaction } = await import("@solana/web3.js");
    const { claimBagsFees, extractManualReconciliationClaimSignatures } =
      await importHelpers({
        bagsClient: {
          getClaimTransactions: vi.fn(async () => ({
            transactions: [new Transaction()],
          })),
          signAndSubmitTransaction: vi.fn(async () => "claim-sig-1"),
        },
        confirmTransaction: vi.fn(async () => {
          throw new Error("confirmation_timeout");
        }),
      });

    await expect(
      claimBagsFees({
        walletAddress: "pool-wallet",
        tokenMint: "So11111111111111111111111111111111111111112",
      }),
    ).rejects.toThrow(
      /manual_reconciliation_required_external_side_effect_may_have_succeeded:claim_signatures=claim-sig-1;confirmation_timeout/,
    );

    expect(
      extractManualReconciliationClaimSignatures(
        "manual_reconciliation_required_external_side_effect_may_have_succeeded:claim_signatures=claim-sig-1;confirmation_timeout",
      ),
    ).toBe("claim-sig-1");
  });

  it("does not retry recipients already marked for manual reconciliation", async () => {
    const limit = vi
      .fn()
      .mockResolvedValueOnce([{ status: "distributing" }])
      .mockResolvedValueOnce([
        {
          id: "recipient-1",
          status: "failed",
          sendAttemptId: null,
          sendingAt: null,
          txSignature: null,
          error:
            "manual_reconciliation_required_external_side_effect_may_have_succeeded:recipient=recipient-1;signature=sig-1;db_timeout",
        },
      ]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const dbHttp = {
      select: vi.fn(() => ({ from })),
      update: vi.fn(),
    };
    const { dispatchRecipient } = await importHelpers({ dbHttp });

    await expect(
      dispatchRecipient({
        payoutId: "payout-1",
        sourcePayoutId: "payout-1",
        escrowDays: 30,
        recipient: {
          contributorId: "alice",
          rank: 1,
          weight: 1,
          amountLamports: "100",
          walletAddress: "alice-wallet",
          idempotencyKey: "idem-1",
        },
      }),
    ).resolves.toEqual({ status: "skipped" });
    expect(dbHttp.update).not.toHaveBeenCalled();
  });
});
