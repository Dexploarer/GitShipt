import { afterEach, describe, expect, it, vi } from "vitest";
import { summarizeFundIssues } from "./accounting";

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

describe("summarizeFundIssues", () => {
  it("marks a hot-wallet shortfall critical", () => {
    const result = summarizeFundIssues({
      hotWalletAddress: "HotWallet111111111111111111111111111111111",
      hotWalletBalanceLamports: 500n,
      escrowLiabilityLamports: 700n,
      unsettledRecipientLamports: 100n,
      manualReviewCount: 0,
      staleSignatureCount: 0,
      activeSplEscrowCount: 0,
      killSwitchEnabled: false,
    });

    expect(result.status).toBe("critical");
    expect(result.issues[0]).toMatchObject({
      code: "hot_wallet_shortfall",
      amountLamports: "300",
    });
  });

  it("warns on unresolved accounting states without marking a shortfall", () => {
    const result = summarizeFundIssues({
      hotWalletAddress: "HotWallet111111111111111111111111111111111",
      hotWalletBalanceLamports: 10_000n,
      escrowLiabilityLamports: 700n,
      unsettledRecipientLamports: 100n,
      manualReviewCount: 1,
      staleSignatureCount: 1,
      activeSplEscrowCount: 1,
      killSwitchEnabled: true,
    });

    expect(result.status).toBe("warning");
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "manual_reconciliation_required",
      "signature_not_finalized",
      "spl_escrow_not_implemented",
      "kill_switch_enabled",
    ]);
  });
});

describe("runFundReconciliation", () => {
  afterEach(() => {
    vi.doUnmock("@/db");
    vi.doUnmock("@/lib/db-rls");
    vi.doUnmock("@/lib/env");
    vi.doUnmock("@/lib/payouts/safety");
    vi.doUnmock("@/lib/solana/signer");
    vi.resetModules();
  });

  it("keeps failed manual payout claims in review metrics and unsettled liabilities", async () => {
    vi.resetModules();
    const executedSql: string[] = [];
    const execute = vi.fn(async (query: unknown) => {
      const text = sqlText(query);
      executedSql.push(text);
      if (text.includes("from payout_recipients pr")) {
        return { rows: [{ amount: "123" }] };
      }
      if (text.includes("from escrow_holdings") && text.includes("token_mint is null")) {
        return { rows: [{ amount: "0" }] };
      }
      if (text.includes("from escrow_holdings") && text.includes("token_mint is not null")) {
        return { rows: [{ count: "0" }] };
      }
      if (text.includes("from payouts") && text.includes("last_error like")) {
        return { rows: [{ count: "1" }] };
      }
      return { rows: [{ count: "0" }] };
    });

    vi.doMock("@/db", () => ({
      dbHttp: {
        execute,
        insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      },
    }));
    vi.doMock("@/lib/db-rls", () => ({ enterDbWorkflowContext: vi.fn() }));
    vi.doMock("@/lib/env", () => ({
      hasCredentials: { solana: () => false },
    }));
    vi.doMock("@/lib/payouts/safety", () => ({
      getHotWalletBalance: vi.fn(async () => 0n),
      isKillSwitchEnabled: vi.fn(async () => false),
    }));
    vi.doMock("@/lib/solana/signer", () => ({
      payoutSignerPublicKey: vi.fn(() => "HotWallet111111111111111111111111111111111"),
    }));

    const { runFundReconciliation } = await import("./reconciliation");
    const summary = await runFundReconciliation();

    expect(summary.unsettledRecipientLamports).toBe("123");
    expect(summary.manualReviewCount).toBe(1);
    const unsettledSql = executedSql.find((text) =>
      text.includes("from payout_recipients pr"),
    );
    expect(unsettledSql).toContain("p.status = 'failed'");
    expect(unsettledSql).toContain("p.last_error like");
    expect(unsettledSql).toContain("p.claim_signature is not null");
    const manualSql = executedSql.find(
      (text) =>
        text.includes("from payouts") && text.includes("last_error like"),
    );
    expect(manualSql).toContain("claim_finalized_at is null");
  });
});
