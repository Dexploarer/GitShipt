import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type AttemptStatus = "pending" | "sending" | "succeeded" | "failed" | "skipped";

interface AttemptState {
  id: string;
  projectId: string;
  plan: {
    feeClaimers: Array<{
      wallet: string;
      bps: number;
      role: "contributor" | "contributor_pool" | "treasury";
    }>;
    contributorPoolBps: number;
    directContributorBps: number;
    treasuryBps: number;
    pooledUnlinkedBps: number;
    pooledOverflowBps: number;
    pooledRoundingBps: number;
  };
  status: AttemptStatus;
  signatures: string[];
  error: string | null;
  attemptCount: number;
}

interface ProjectState {
  tokenMint: string;
  bagsPoolClaimerWallet: string;
}

interface UpdateValues {
  status?: AttemptStatus;
  signatures?: string[];
  error?: string | null;
  attemptCount?: unknown;
  startedAt?: Date;
  completedAt?: Date;
  updatedAt?: Date;
}

function createDbHttpMock(args: {
  attempt: AttemptState;
  project: ProjectState;
}) {
  let selectCount = 0;
  let claimed = false;
  const updateValues: UpdateValues[] = [];

  const dbHttp = {
    select: vi.fn(() => {
      const chain = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        limit: vi.fn(async () => {
          selectCount += 1;
          return selectCount === 1 ? [args.attempt] : [args.project];
        }),
      };
      return chain;
    }),
    update: vi.fn(() => {
      let pending: UpdateValues = {};
      const chain = {
        set: vi.fn((values: UpdateValues) => {
          pending = values;
          return chain;
        }),
        where: vi.fn(() => {
          if (pending.status === "sending") {
            claimed =
              args.attempt.status === "pending" ||
              args.attempt.status === "failed";
            if (!claimed) return chain;
            args.attempt.attemptCount += 1;
          }
          updateValues.push(pending);
          Object.assign(args.attempt, pending);
          return chain;
        }),
        returning: vi.fn(async () =>
          claimed
            ? [
                {
                  id: args.attempt.id,
                  plan: args.attempt.plan,
                  projectId: args.attempt.projectId,
                },
              ]
            : [],
        ),
      };
      return chain;
    }),
  };

  return { dbHttp, updateValues };
}

async function importHelpers(args: {
  dbHttp: ReturnType<typeof createDbHttpMock>["dbHttp"];
  signatures: string[];
  confirm:
    | ((signature: string) => Promise<{ value: { err: unknown } }>)
    | undefined;
}) {
  vi.resetModules();
  vi.doMock("@/db", () => ({
    dbHttp: args.dbHttp,
    dbPool: vi.fn(),
    schema: {},
  }));
  vi.doMock("@/lib/bags/client", () => ({
    bags: {
      getUpdateFeeShareConfigTransactions: vi.fn(async () =>
        args.signatures.map((signature) => ({
          transaction: { signature },
        })),
      ),
      signAndSubmitTransaction: vi.fn(async (transaction: { signature: string }) => {
        if (transaction.signature === "throw-submit") {
          throw new Error("bags_submit_failed");
        }
        return transaction.signature;
      }),
    },
  }));
  vi.doMock("@/lib/db-rls", () => ({
    applyDbRlsContext: vi.fn(),
    enterDbWorkflowContext: vi.fn(),
  }));
  vi.doMock("@/lib/env", () => ({
    serverEnv: () => ({
      SOLANA_TREASURY_ADDRESS: "treasury-wallet",
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
    isKillSwitchEnabled: vi.fn(async () => false),
  }));
  vi.doMock("@/lib/solana/connection", () => ({
    solanaConnection: vi.fn(() => ({
      confirmTransaction:
        args.confirm ??
        vi.fn(async () => ({
          value: { err: null },
        })),
    })),
  }));
  vi.doMock("@/lib/solana/signer", () => ({
    payoutSignerPublicKey: vi.fn(() => "pool-claimer-wallet"),
  }));
  vi.doMock("./snapshot-helpers", () => ({
    loadContributorWallets: vi.fn(async () => ({})),
  }));

  return await import("./fee-share-update-helpers");
}

function attemptState(overrides?: Partial<AttemptState>): AttemptState {
  return {
    id: "fee-share-attempt-1",
    projectId: "project-1",
    plan: {
      feeClaimers: [
        { wallet: "alice-wallet", bps: 6_000, role: "contributor" },
        { wallet: "treasury-wallet", bps: 4_000, role: "treasury" },
      ],
      contributorPoolBps: 0,
      directContributorBps: 6_000,
      treasuryBps: 4_000,
      pooledUnlinkedBps: 0,
      pooledOverflowBps: 0,
      pooledRoundingBps: 0,
    },
    status: "pending",
    signatures: [],
    error: null,
    attemptCount: 0,
    ...overrides,
  };
}

describe("fee-share update helpers", () => {
  afterEach(() => {
    vi.doUnmock("@/db");
    vi.doUnmock("@/lib/bags/client");
    vi.doUnmock("@/lib/db-rls");
    vi.doUnmock("@/lib/env");
    vi.doUnmock("@/lib/payouts/safety");
    vi.doUnmock("@/lib/solana/connection");
    vi.doUnmock("@/lib/solana/signer");
    vi.doUnmock("./snapshot-helpers");
  });

  it("persists submitted signatures and marks manual reconciliation when a later transaction fails", async () => {
    const attempt = attemptState();
    const { dbHttp, updateValues } = createDbHttpMock({
      attempt,
      project: {
        tokenMint: "So11111111111111111111111111111111111111112",
        bagsPoolClaimerWallet: "pool-claimer-wallet",
      },
    });
    const { executeFeeShareUpdateAttempt } = await importHelpers({
      dbHttp,
      signatures: ["sig-first", "throw-submit"],
      confirm: undefined,
    });

    const result = await executeFeeShareUpdateAttempt(attempt.id);

    expect(result.status).toBe("failed");
    expect(result.signatures).toEqual(["sig-first"]);
    expect(attempt.signatures).toEqual(["sig-first"]);
    expect(attempt.error).toContain(
      "manual_reconciliation_required_external_side_effect_may_have_succeeded",
    );
    expect(attempt.error).toContain("fee_share_update_signatures=sig-first");
    expect(updateValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ signatures: ["sig-first"] }),
      ]),
    );
  });

  it("marks manual reconciliation when confirmation fails after submission", async () => {
    const attempt = attemptState();
    const { dbHttp } = createDbHttpMock({
      attempt,
      project: {
        tokenMint: "So11111111111111111111111111111111111111112",
        bagsPoolClaimerWallet: "pool-claimer-wallet",
      },
    });
    const { executeFeeShareUpdateAttempt } = await importHelpers({
      dbHttp,
      signatures: ["sig-first"],
      confirm: vi.fn(async () => ({
        value: { err: { InstructionError: [0, "Custom"] } },
      })),
    });

    const result = await executeFeeShareUpdateAttempt(attempt.id);

    expect(result.status).toBe("failed");
    expect(result.signatures).toEqual(["sig-first"]);
    expect(attempt.signatures).toEqual(["sig-first"]);
    expect(attempt.error).toContain(
      "manual_reconciliation_required_external_side_effect_may_have_succeeded",
    );
    expect(attempt.error).toContain("fee_share_update_confirmation_failed");
  });

  it("skips blind retry when a failed attempt already has submitted signatures", async () => {
    const attempt = attemptState({
      status: "failed",
      signatures: ["sig-needs-review"],
      error:
        "manual_reconciliation_required_external_side_effect_may_have_succeeded:fee_share_update_signatures=sig-needs-review",
    });
    const { dbHttp } = createDbHttpMock({
      attempt,
      project: {
        tokenMint: "So11111111111111111111111111111111111111112",
        bagsPoolClaimerWallet: "pool-claimer-wallet",
      },
    });
    const { executeFeeShareUpdateAttempt } = await importHelpers({
      dbHttp,
      signatures: ["sig-should-not-send"],
      confirm: undefined,
    });

    const result = await executeFeeShareUpdateAttempt(attempt.id);

    expect(result).toEqual({
      attemptId: attempt.id,
      status: "skipped",
      signatures: ["sig-needs-review"],
      reason: "manual_reconciliation_required",
    });
    expect(dbHttp.update).not.toHaveBeenCalled();
  });
});
