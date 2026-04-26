/**
 * Snapshot pipeline DB helpers. These are NOT step functions — they're
 * called from inside `'use step'` blocks in workflows/takeSnapshot.ts.
 *
 * All return values are JSON-serializable (no Date instances; bigints as
 * decimal strings) so they survive workflow step boundaries.
 */
import { dbHttp } from "@/db";
import {
  contributors,
  projects,
  snapshots,
  contributorClaims,
  wallets,
} from "@/db/schema";
import type {
  ScoringConfig,
  PayoutConfig,
} from "@/db/schema/projects";
import type { LeaderboardEntry } from "@/db/schema/snapshots";
import type { ContributorScoreInputs } from "@/db/schema/contributors";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import {
  buildLeaderboardEntries,
  type SnapshotContributor,
} from "@/lib/payouts/distribution";
import { computeMerkleRoot } from "@/lib/payouts/merkle";

export interface LoadedProjectForSnapshot {
  id: string;
  name: string;
  status: "draft" | "live" | "paused" | "killed" | "simulated_live";
  tokenMint: string | null;
  scoringConfig: ScoringConfig;
  payoutConfig: PayoutConfig;
}

/** Projects with status='live' that have at least one ranked contributor. */
export async function loadEligibleProjectIds(): Promise<string[]> {
  const rows = await dbHttp.execute<{ id: string }>(sql`
    select p.id::text as id
    from projects p
    where p.status = 'live'
      and exists (
        select 1 from contributors c
        where c.project_id = p.id
          and c.rank is not null
          and c.excluded = 'false'
      )
  `);
  return rows.rows.map((r) => r.id);
}

export async function loadProjectForSnapshot(
  projectId: string,
): Promise<LoadedProjectForSnapshot | null> {
  const [row] = await dbHttp
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      tokenMint: projects.tokenMint,
      scoringConfig: projects.scoringConfig,
      payoutConfig: projects.payoutConfig,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return row ?? null;
}

/**
 * Top-N contributors for a project (rank ASC, excluded=false, rank not null).
 * Returns SnapshotContributor[] suitable for buildLeaderboardEntries.
 */
export async function loadRankedContributors(
  projectId: string,
  topN: number,
): Promise<SnapshotContributor[]> {
  const limit = Math.max(0, Math.floor(topN));
  if (limit === 0) return [];
  const rows = await dbHttp
    .select({
      id: contributors.id,
      ghUserId: contributors.ghUserId,
      ghUsername: contributors.ghUsername,
      rank: contributors.rank,
      score: contributors.score,
      inputs: contributors.inputs,
    })
    .from(contributors)
    .where(
      and(
        eq(contributors.projectId, projectId),
        eq(contributors.excluded, "false"),
        isNotNull(contributors.rank),
      ),
    )
    .orderBy(contributors.rank)
    .limit(limit);

  return rows
    .filter((r): r is typeof r & { rank: number } => r.rank !== null)
    .map((r) => ({
      id: r.id,
      ghUserId: r.ghUserId,
      ghUsername: r.ghUsername,
      rank: r.rank,
      score: r.score,
      inputs: r.inputs as ContributorScoreInputs,
    }));
}

export interface FreezeSnapshotResult {
  snapshotId: string;
  takenAtISO: string;
  merkleRoot: string;
  leaderboardCount: number;
}

/**
 * Insert a frozen snapshot row. Uses dbHttp single-shot insert — the freeze
 * is naturally atomic (one insert, no dependents at this stage). The payout
 * row that references this snapshot is created later by executePayout.
 */
export async function freezeSnapshot(args: {
  projectId: string;
  formulaVersion: string;
  leaderboard: LeaderboardEntry[];
  takenAtISO?: string;
}): Promise<FreezeSnapshotResult> {
  const takenAt = args.takenAtISO ? new Date(args.takenAtISO) : new Date();
  const merkleRoot = computeMerkleRoot(
    args.leaderboard.map((e) => ({
      contributorId: e.contributorId,
      // weight gets us to a per-contributor target; for snapshot integrity
      // we hash the (contributorId, weight) projection so the root depends
      // on the rank ordering AND the tier weights chosen at snapshot time.
      // Amount-in-lamports isn't known yet (no claim total) — Merkle root
      // is updated to the amount tree at payout time inside executePayout.
      amountLamports: BigInt(Math.round(e.weight * 1_000_000_000)),
    })),
  );

  const [inserted] = await dbHttp
    .insert(snapshots)
    .values({
      projectId: args.projectId,
      takenAt,
      formulaVersion: args.formulaVersion,
      leaderboard: args.leaderboard,
      merkleRoot,
      totalFeesLamports: 0n,
      status: "frozen",
      forced: "false",
    })
    .returning({ id: snapshots.id });

  if (!inserted) {
    throw new Error("freezeSnapshot: insert returned no row");
  }

  return {
    snapshotId: inserted.id,
    takenAtISO: takenAt.toISOString(),
    merkleRoot,
    leaderboardCount: args.leaderboard.length,
  };
}

/**
 * Bulk-load wallet addresses for a set of contributorIds.
 * Returns a map { [contributorId]: walletAddress | null }.
 *
 * Joins contributor_claims (linked user) with wallets (primary wallet for
 * that user). When a contributor has no claim or the user has no wallet,
 * the entry is missing from the map (callers treat as null).
 */
export async function loadContributorWallets(
  contributorIds: string[],
): Promise<Record<string, string>> {
  if (contributorIds.length === 0) return {};
  const rows = await dbHttp
    .select({
      contributorId: contributorClaims.contributorId,
      walletAddress: wallets.address,
      isPrimary: wallets.isPrimary,
    })
    .from(contributorClaims)
    .innerJoin(wallets, eq(wallets.userId, contributorClaims.userId))
    .where(
      sql`${contributorClaims.contributorId} = any(${contributorIds}::text[])`,
    );

  // Prefer is_primary='true' when a user has multiple wallets.
  const map: Record<string, string> = {};
  for (const r of rows) {
    if (!map[r.contributorId] || r.isPrimary === "true") {
      map[r.contributorId] = r.walletAddress;
    }
  }
  return map;
}

// Re-export pure helpers for workflow callsites.
export { buildLeaderboardEntries };
