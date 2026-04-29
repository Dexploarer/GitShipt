import type { PayoutConfig } from "@/db/schema/projects";
import type { LeaderboardEntry } from "@/db/schema/snapshots";

const BAGS_MAX_FEE_CLAIMERS = 100;
const TOTAL_BPS = 10_000;

export type BagsFeeShareRole =
  | "contributor"
  | "contributor_pool"
  | "treasury";

export interface BagsFeeShareClaimer {
  wallet: string;
  bps: number;
  role: BagsFeeShareRole;
}

export interface BagsFeeShareDistributionPlan {
  feeClaimers: BagsFeeShareClaimer[];
  contributorPoolBps: number;
  directContributorBps: number;
  treasuryBps: number;
  pooledUnlinkedBps: number;
  pooledOverflowBps: number;
  pooledRoundingBps: number;
}

export interface BuildBagsFeeShareDistributionInput {
  leaderboard: ReadonlyArray<LeaderboardEntry>;
  payoutConfig: PayoutConfig;
  walletAddresses: Readonly<Record<string, string | null | undefined>>;
  platformFeeBps: number;
  contributorPoolWallet: string;
  treasuryWallet: string;
  maxClaimers?: number;
}

interface WeightedCandidate {
  contributorId: string;
  rank: number;
  walletAddress: string | null;
  payoutRoute: LeaderboardEntry["payoutRoute"];
  scaledWeight: bigint;
  remainder: bigint;
  bps: number;
}

function assertBps(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0 || value > TOTAL_BPS) {
    throw new Error(`${field} must be an integer between 0 and ${TOTAL_BPS}.`);
  }
}

function addClaimer(
  claimers: Map<string, BagsFeeShareClaimer>,
  wallet: string,
  bps: number,
  role: BagsFeeShareRole,
): void {
  if (bps <= 0) return;
  const existing = claimers.get(wallet);
  if (existing) {
    existing.bps += bps;
    if (existing.role !== role) existing.role = "treasury";
    return;
  }
  claimers.set(wallet, { wallet, bps, role });
}

function entryScaledWeight(
  entry: LeaderboardEntry,
  tierWeights: ReadonlyArray<number>,
): bigint {
  const idx = entry.rank - 1;
  const weight =
    idx >= 0 && idx < tierWeights.length ? (tierWeights[idx] ?? 0) : 0;
  return BigInt(Math.round(Math.max(0, weight) * 1_000_000_000));
}

/**
 * Builds the Bags fee-share config for the next accrual window.
 *
 * Linked contributors receive direct Bags claimers. Unlinked contributors,
 * max-claimer overflow, and rounding dust go to the GitShipt contributor pool
 * wallet so the funds remain claimable through GitShipt after verification.
 */
export function buildBagsFeeShareDistributionPlan(
  input: BuildBagsFeeShareDistributionInput,
): BagsFeeShareDistributionPlan {
  assertBps(input.platformFeeBps, "platformFeeBps");
  const maxClaimers = input.maxClaimers ?? BAGS_MAX_FEE_CLAIMERS;
  if (!Number.isInteger(maxClaimers) || maxClaimers < 1) {
    throw new Error("maxClaimers must be a positive integer.");
  }

  const contributorBudgetBps = TOTAL_BPS - input.platformFeeBps;
  const top = input.leaderboard.slice(0, Math.max(0, input.payoutConfig.topN));
  const weighted: WeightedCandidate[] = top.map((entry) => ({
    contributorId: entry.contributorId,
    rank: entry.rank,
    walletAddress: input.walletAddresses[entry.contributorId] ?? null,
    payoutRoute: entry.payoutRoute,
    scaledWeight: entryScaledWeight(entry, input.payoutConfig.tierWeights),
    remainder: 0n,
    bps: 0,
  }));

  const totalWeight = weighted.reduce((sum, row) => sum + row.scaledWeight, 0n);
  if (contributorBudgetBps > 0 && totalWeight === 0n) {
    return {
      feeClaimers: [
        { wallet: input.contributorPoolWallet, bps: contributorBudgetBps, role: "contributor_pool" },
        ...(input.platformFeeBps > 0
          ? [{ wallet: input.treasuryWallet, bps: input.platformFeeBps, role: "treasury" as const }]
          : []),
      ],
      contributorPoolBps: contributorBudgetBps,
      directContributorBps: 0,
      treasuryBps: input.platformFeeBps,
      pooledUnlinkedBps: contributorBudgetBps,
      pooledOverflowBps: 0,
      pooledRoundingBps: 0,
    };
  }

  let assignedBps = 0;
  for (const row of weighted) {
    if (totalWeight === 0n || contributorBudgetBps === 0) continue;
    const numerator = BigInt(contributorBudgetBps) * row.scaledWeight;
    row.bps = Number(numerator / totalWeight);
    row.remainder = numerator % totalWeight;
    assignedBps += row.bps;
  }

  let roundingBps = contributorBudgetBps - assignedBps;
  const directSlots = Math.max(0, maxClaimers - (input.platformFeeBps > 0 ? 2 : 1));
  const directEligible = weighted
    .filter(
      (row) =>
        row.bps > 0 &&
        row.payoutRoute !== "treasury" &&
        Boolean(row.walletAddress),
    )
    .sort((a, b) => a.rank - b.rank);
  const directIds = new Set(
    directEligible.slice(0, directSlots).map((row) => row.contributorId),
  );

  const claimers = new Map<string, BagsFeeShareClaimer>();
  let directContributorBps = 0;
  let pooledUnlinkedBps = 0;
  let pooledOverflowBps = 0;
  let treasuryContributorBps = 0;

  for (const row of weighted) {
    if (row.bps <= 0) continue;
    if (row.payoutRoute === "treasury") {
      treasuryContributorBps += row.bps;
      addClaimer(claimers, input.treasuryWallet, row.bps, "treasury");
      continue;
    }
    if (!row.walletAddress) {
      pooledUnlinkedBps += row.bps;
      addClaimer(claimers, input.contributorPoolWallet, row.bps, "contributor_pool");
      continue;
    }
    if (!directIds.has(row.contributorId)) {
      pooledOverflowBps += row.bps;
      addClaimer(claimers, input.contributorPoolWallet, row.bps, "contributor_pool");
      continue;
    }
    directContributorBps += row.bps;
    addClaimer(claimers, row.walletAddress, row.bps, "contributor");
  }

  if (roundingBps > 0) {
    addClaimer(claimers, input.contributorPoolWallet, roundingBps, "contributor_pool");
  } else {
    roundingBps = 0;
  }
  if (input.platformFeeBps > 0) {
    addClaimer(claimers, input.treasuryWallet, input.platformFeeBps, "treasury");
  }

  const feeClaimers = Array.from(claimers.values()).filter((row) => row.bps > 0);
  const total = feeClaimers.reduce((sum, row) => sum + row.bps, 0);
  if (total !== TOTAL_BPS) {
    throw new Error(`Bags fee-share plan must total ${TOTAL_BPS} bps; got ${total}.`);
  }
  if (feeClaimers.length > maxClaimers) {
    throw new Error(`Bags fee-share plan exceeds ${maxClaimers} claimers.`);
  }

  return {
    feeClaimers,
    contributorPoolBps: pooledUnlinkedBps + pooledOverflowBps + roundingBps,
    directContributorBps,
    treasuryBps: input.platformFeeBps + treasuryContributorBps,
    pooledUnlinkedBps,
    pooledOverflowBps,
    pooledRoundingBps: roundingBps,
  };
}
