import type {
  FundReconciliationIssueJson,
  PartnerClaimStatsJson,
} from "@/db/schema/fund-reconciliation";

export function derivePartnerClaimDeltas(
  before: PartnerClaimStatsJson,
  after: PartnerClaimStatsJson,
): { claimedDeltaLamports: bigint; unclaimedDeltaLamports: bigint } {
  return {
    claimedDeltaLamports:
      BigInt(after.claimedFees) - BigInt(before.claimedFees),
    unclaimedDeltaLamports:
      BigInt(after.unclaimedFees) - BigInt(before.unclaimedFees),
  };
}

export function summarizeFundIssues(input: {
  hotWalletAddress: string | null;
  hotWalletBalanceLamports: bigint;
  escrowLiabilityLamports: bigint;
  unsettledRecipientLamports: bigint;
  manualReviewCount: number;
  staleSignatureCount: number;
  activeSplEscrowCount: number;
  killSwitchEnabled: boolean;
}): {
  status: "clean" | "warning" | "critical";
  issues: FundReconciliationIssueJson[];
} {
  const issues: FundReconciliationIssueJson[] = [];
  const liabilities =
    input.escrowLiabilityLamports + input.unsettledRecipientLamports;

  if (!input.hotWalletAddress) {
    issues.push({
      severity: "warning",
      code: "hot_wallet_unavailable",
      message:
        "Payout signer is not configured, so live balance reconciliation is incomplete.",
    });
  } else if (input.hotWalletBalanceLamports < liabilities) {
    issues.push({
      severity: "critical",
      code: "hot_wallet_shortfall",
      message: "Hot wallet balance is below recorded SOL liabilities.",
      amountLamports: (liabilities - input.hotWalletBalanceLamports).toString(),
    });
  }

  if (input.manualReviewCount > 0) {
    issues.push({
      severity: "warning",
      code: "manual_reconciliation_required",
      message: "One or more money-moving rows require operator reconciliation.",
    });
  }

  if (input.staleSignatureCount > 0) {
    issues.push({
      severity: "warning",
      code: "signature_not_finalized",
      message:
        "One or more recorded signatures were not finalized during this pass.",
    });
  }

  if (input.activeSplEscrowCount > 0) {
    issues.push({
      severity: "warning",
      code: "spl_escrow_not_implemented",
      message:
        "Active SPL escrow liabilities exist, but SPL escrow drain is still fail-closed.",
    });
  }

  if (input.killSwitchEnabled) {
    issues.push({
      severity: "warning",
      code: "kill_switch_enabled",
      message:
        "Global kill switch is enabled; money-moving workers will skip dispatch.",
    });
  }

  const status = issues.some((issue) => issue.severity === "critical")
    ? "critical"
    : issues.length > 0
      ? "warning"
      : "clean";
  return { status, issues };
}
