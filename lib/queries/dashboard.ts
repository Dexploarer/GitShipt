import "server-only";
import { dbHttp } from "@/db";
import {
  projects,
  contributors,
  contributorClaims,
  payouts,
  payoutRecipients,
  escrowHoldings,
  wallets,
  ghIndexerState,
  projectMemberships,
  users,
} from "@/db/schema";
import type { ProjectRole } from "@/lib/auth/permissions";
import { and, desc, eq, sql, isNotNull, or, inArray } from "drizzle-orm";

/**
 * Query helpers for the project admin console (`/dashboard/**`).
 *
 * All reads use the HTTP driver — no transactional state to maintain — and
 * are scoped to `userId` so a leaked or compromised session cannot enumerate
 * other people's projects.
 */

export interface MyProjectRow {
  id: string;
  slug: string; // `${ghOwner}/${ghRepo}`
  ghOwner: string;
  ghRepo: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  status: "draft" | "live" | "paused" | "killed";
  tokenMint: string | null;
  contributorsCount: number;
  lifetimeFeesLamports: bigint;
  lastPayoutAt: Date | null;
  createdAt: Date;
}

/**
 * List every project the user owns OR has a project_membership in.
 * Counts contributors and sums confirmed payout lamports per project in two
 * follow-up queries (avoids N+1 by batching with `inArray`).
 */
export async function getMyProjects(userId: string): Promise<MyProjectRow[]> {
  // 1. Find project IDs the user is owner or member of.
  const ownedRows = await dbHttp
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.ownerUserId, userId));

  const memberRows = await dbHttp
    .select({ id: projectMemberships.projectId })
    .from(projectMemberships)
    .where(eq(projectMemberships.userId, userId));

  const ids = Array.from(
    new Set([...ownedRows.map((r) => r.id), ...memberRows.map((r) => r.id)]),
  );
  if (ids.length === 0) return [];

  const rows = await dbHttp
    .select()
    .from(projects)
    .where(inArray(projects.id, ids));

  // 2. Per-project contributor count (single grouped query).
  const counts = await dbHttp
    .select({
      projectId: contributors.projectId,
      n: sql<number>`count(*)::int`,
    })
    .from(contributors)
    .where(inArray(contributors.projectId, ids))
    .groupBy(contributors.projectId);
  const countMap = new Map(counts.map((r) => [r.projectId, r.n]));

  // 3. Per-project lifetime fees + last completed payout.
  const payoutAgg = await dbHttp
    .select({
      projectId: payouts.projectId,
      lifetime: sql<string>`coalesce(sum(${payouts.totalAmountLamports}), 0)::text`,
      lastAt: sql<Date | null>`max(${payouts.executedAt})`,
    })
    .from(payouts)
    .where(
      and(inArray(payouts.projectId, ids), eq(payouts.status, "completed")),
    )
    .groupBy(payouts.projectId);
  const payoutMap = new Map(
    payoutAgg.map((r) => [
      r.projectId,
      { lifetime: BigInt(r.lifetime ?? "0"), lastAt: r.lastAt },
    ]),
  );

  return rows.map((r) => {
    const agg = payoutMap.get(r.id);
    return {
      id: r.id,
      slug: `${r.ghOwner}/${r.ghRepo}`,
      ghOwner: r.ghOwner,
      ghRepo: r.ghRepo,
      name: r.name,
      description: r.description,
      imageUrl: r.imageUrl,
      status: r.status,
      tokenMint: r.tokenMint,
      contributorsCount: countMap.get(r.id) ?? 0,
      lifetimeFeesLamports: agg?.lifetime ?? 0n,
      lastPayoutAt: agg?.lastAt ?? null,
      createdAt: r.createdAt,
    };
  });
}

export interface ProjectKPIs {
  totalContributorsRanked: number;
  totalPayoutsExecuted: number;
  lifetimeFeesLamports: bigint;
  pendingEscrowLamports: bigint;
  lastSnapshotAt: Date | null;
  nextPayoutAt: Date;
}

function nextPayoutAt(now: Date = new Date()): Date {
  const next = new Date(now);
  next.setUTCHours(0, 30, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

export async function getProjectKPIs(projectId: string): Promise<ProjectKPIs> {
  const [contribCountRows, payoutAggRows, escrowRows, lastSnapRows] =
    await Promise.all([
      dbHttp
        .select({ n: sql<number>`count(*)::int` })
        .from(contributors)
        .where(
          and(
            eq(contributors.projectId, projectId),
            isNotNull(contributors.rank),
          ),
        ),
      dbHttp
        .select({
          n: sql<number>`count(*)::int`,
          lifetime: sql<string>`coalesce(sum(${payouts.totalAmountLamports}), 0)::text`,
        })
        .from(payouts)
        .where(
          and(
            eq(payouts.projectId, projectId),
            eq(payouts.status, "completed"),
          ),
        ),
      dbHttp
        .select({
          total: sql<string>`coalesce(sum(${escrowHoldings.amountLamports}), 0)::text`,
        })
        .from(escrowHoldings)
        .innerJoin(
          contributors,
          eq(contributors.id, escrowHoldings.contributorId),
        )
        .where(
          and(
            eq(contributors.projectId, projectId),
            sql`${escrowHoldings.drainedAt} is null`,
          ),
        ),
      dbHttp
        .select({ at: sql<Date | null>`max(executed_at)` })
        .from(payouts)
        .where(eq(payouts.projectId, projectId)),
    ]);

  return {
    totalContributorsRanked: contribCountRows[0]?.n ?? 0,
    totalPayoutsExecuted: payoutAggRows[0]?.n ?? 0,
    lifetimeFeesLamports: BigInt(payoutAggRows[0]?.lifetime ?? "0"),
    pendingEscrowLamports: BigInt(escrowRows[0]?.total ?? "0"),
    lastSnapshotAt: lastSnapRows[0]?.at ?? null,
    nextPayoutAt: nextPayoutAt(),
  };
}

export interface PayoutHistoryRow {
  id: string;
  executedAt: Date | null;
  status: "pending" | "claiming" | "distributing" | "completed" | "failed" | "cancelled";
  totalLamports: bigint;
  recipientCount: number;
  claimSignature: string | null;
  snapshotId: string;
  attemptCount: number;
}

export async function getProjectPayoutHistory(
  projectId: string,
  limit = 50,
): Promise<PayoutHistoryRow[]> {
  const rows = await dbHttp
    .select({
      id: payouts.id,
      executedAt: payouts.executedAt,
      status: payouts.status,
      totalLamports: payouts.totalAmountLamports,
      claimSignature: payouts.claimSignature,
      snapshotId: payouts.snapshotId,
      attemptCount: payouts.attemptCount,
      recipientCount: sql<number>`count(${payoutRecipients.id})::int`,
    })
    .from(payouts)
    .leftJoin(payoutRecipients, eq(payoutRecipients.payoutId, payouts.id))
    .where(eq(payouts.projectId, projectId))
    .groupBy(payouts.id)
    .orderBy(desc(payouts.scheduledAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    executedAt: r.executedAt,
    status: r.status,
    totalLamports: r.totalLamports,
    recipientCount: r.recipientCount ?? 0,
    claimSignature: r.claimSignature,
    snapshotId: r.snapshotId,
    attemptCount: r.attemptCount,
  }));
}

export interface MyEarnings {
  totalLifetimeLamports: bigint;
  pendingEscrowLamports: bigint;
  byProject: Array<{
    projectSlug: string;
    lifetimeLamports: bigint;
    escrowLamports: bigint;
  }>;
}

/**
 * Sum across every contributor row claimed by this user. A user can claim
 * many contributors (one per repo they've contributed to under their GitHub
 * identity).
 */
export async function getMyEarnings(userId: string): Promise<MyEarnings> {
  // Find contributor IDs claimed by this user.
  const claims = await dbHttp
    .select({ contributorId: contributorClaims.contributorId })
    .from(contributorClaims)
    .where(eq(contributorClaims.userId, userId));
  const contribIds = claims.map((c) => c.contributorId);

  if (contribIds.length === 0) {
    return {
      totalLifetimeLamports: 0n,
      pendingEscrowLamports: 0n,
      byProject: [],
    };
  }

  // Per-contributor lifetime sent + escrow + project slug.
  const lifetimeRows = await dbHttp
    .select({
      projectSlug: sql<string>`${projects.ghOwner} || '/' || ${projects.ghRepo}`,
      lifetime: sql<string>`coalesce(sum(${payoutRecipients.amountLamports}) filter (where ${payoutRecipients.status} in ('sent','confirmed')), 0)::text`,
    })
    .from(payoutRecipients)
    .innerJoin(contributors, eq(contributors.id, payoutRecipients.contributorId))
    .innerJoin(projects, eq(projects.id, contributors.projectId))
    .where(inArray(payoutRecipients.contributorId, contribIds))
    .groupBy(projects.id, projects.ghOwner, projects.ghRepo);

  const escrowAggRows = await dbHttp
    .select({
      projectSlug: sql<string>`${projects.ghOwner} || '/' || ${projects.ghRepo}`,
      escrow: sql<string>`coalesce(sum(${escrowHoldings.amountLamports}) filter (where ${escrowHoldings.drainedAt} is null), 0)::text`,
    })
    .from(escrowHoldings)
    .innerJoin(contributors, eq(contributors.id, escrowHoldings.contributorId))
    .innerJoin(projects, eq(projects.id, contributors.projectId))
    .where(inArray(escrowHoldings.contributorId, contribIds))
    .groupBy(projects.id, projects.ghOwner, projects.ghRepo);

  const escrowBySlug = new Map(
    escrowAggRows.map((r) => [r.projectSlug, BigInt(r.escrow ?? "0")]),
  );
  const lifetimeBySlug = new Map(
    lifetimeRows.map((r) => [r.projectSlug, BigInt(r.lifetime ?? "0")]),
  );

  const slugSet = new Set<string>([
    ...lifetimeBySlug.keys(),
    ...escrowBySlug.keys(),
  ]);

  const byProject = Array.from(slugSet).map((slug) => ({
    projectSlug: slug,
    lifetimeLamports: lifetimeBySlug.get(slug) ?? 0n,
    escrowLamports: escrowBySlug.get(slug) ?? 0n,
  }));

  let total = 0n;
  let escrow = 0n;
  for (const p of byProject) {
    total += p.lifetimeLamports;
    escrow += p.escrowLamports;
  }

  return {
    totalLifetimeLamports: total,
    pendingEscrowLamports: escrow,
    byProject,
  };
}

export interface LinkedWallet {
  id: string;
  address: string;
  chain: string;
  label: string | null;
  isPrimary: boolean;
  verifiedAt: Date;
}

export async function getMyLinkedWallets(
  userId: string,
): Promise<LinkedWallet[]> {
  const rows = await dbHttp
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .orderBy(desc(wallets.verifiedAt));
  return rows.map((r) => ({
    id: r.id,
    address: r.address,
    chain: r.chain,
    label: r.label,
    isPrimary: r.isPrimary === "true",
    verifiedAt: r.verifiedAt,
  }));
}

/**
 * Resolve whether the given user owns a project (or is a member). Returns
 * the membership role string when present, else "owner" if owner, else null.
 */
export async function getUserProjectRole(
  userId: string,
  projectId: string,
): Promise<"owner" | ProjectRole | null> {
  const [proj] = await dbHttp
    .select({ ownerUserId: projects.ownerUserId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!proj) return null;
  if (proj.ownerUserId === userId) return "owner";
  const [m] = await dbHttp
    .select({ role: projectMemberships.role })
    .from(projectMemberships)
    .where(
      and(
        eq(projectMemberships.userId, userId),
        eq(projectMemberships.projectId, projectId),
      ),
    )
    .limit(1);
  return m?.role ?? null;
}

export interface ProjectRecord {
  id: string;
  slug: string;
  ghOwner: string;
  ghRepo: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  status: "draft" | "live" | "paused" | "killed";
  tokenMint: string | null;
  bagsLaunchId: string | null;
  ghInstallationId: string | null;
  platformFeeBps: number;
  scoringConfig: import("@/db/schema").ScoringConfig;
  payoutConfig: import("@/db/schema").PayoutConfig;
  pausedAt: Date | null;
  pausedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getProjectRecord(
  projectId: string,
): Promise<ProjectRecord | null> {
  const [r] = await dbHttp
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!r) return null;
  return {
    id: r.id,
    slug: `${r.ghOwner}/${r.ghRepo}`,
    ghOwner: r.ghOwner,
    ghRepo: r.ghRepo,
    name: r.name,
    description: r.description,
    imageUrl: r.imageUrl,
    status: r.status,
    tokenMint: r.tokenMint,
    bagsLaunchId: r.bagsLaunchId,
    ghInstallationId: r.ghInstallationId,
    platformFeeBps: r.platformFeeBps,
    scoringConfig: r.scoringConfig,
    payoutConfig: r.payoutConfig,
    pausedAt: r.pausedAt,
    pausedReason: r.pausedReason,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export interface RecentAuditEntry {
  id: string;
  action: string;
  actorUserId: string | null;
  actorName: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export async function getRecentProjectAudit(
  projectId: string,
  limit = 10,
): Promise<RecentAuditEntry[]> {
  const rows = await dbHttp
    .select({
      id: sql<string>`al.id`,
      action: sql<string>`al.action`,
      actorUserId: sql<string | null>`al.actor_user_id`,
      actorName: sql<string | null>`u.name`,
      metadata: sql<Record<string, unknown>>`al.metadata`,
      createdAt: sql<Date>`al.created_at`,
    })
    .from(sql`audit_logs al`)
    .leftJoin(users, sql`u.id = al.actor_user_id`)
    .where(
      sql`al.target_type = 'project' and al.target_id = ${projectId}`,
    )
    .orderBy(sql`al.created_at desc`)
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorUserId: r.actorUserId,
    actorName: r.actorName,
    metadata: r.metadata ?? {},
    createdAt: new Date(r.createdAt),
  }));
}

export interface IndexerState {
  lastFullSyncAt: Date | null;
  lastIncrementalSyncAt: Date | null;
  lastError: string | null;
  isStale: boolean; // > 1h since last incremental
}

export async function getIndexerState(
  projectId: string,
): Promise<IndexerState | null> {
  const [r] = await dbHttp
    .select()
    .from(ghIndexerState)
    .where(eq(ghIndexerState.projectId, projectId))
    .limit(1);
  if (!r) return null;
  const last = r.lastIncrementalSyncAt;
  const isStale =
    last == null || Date.now() - last.getTime() > 60 * 60 * 1000;
  return {
    lastFullSyncAt: r.lastFullSyncAt,
    lastIncrementalSyncAt: r.lastIncrementalSyncAt,
    lastError: r.lastError,
    isStale,
  };
}

export interface FailedPayoutAlert {
  id: string;
  scheduledAt: Date;
  attemptCount: number;
  lastError: string | null;
}

export async function getFailedPayoutsForProject(
  projectId: string,
  limit = 5,
): Promise<FailedPayoutAlert[]> {
  const rows = await dbHttp
    .select({
      id: payouts.id,
      scheduledAt: payouts.scheduledAt,
      attemptCount: payouts.attemptCount,
      lastError: payouts.lastError,
    })
    .from(payouts)
    .where(
      and(eq(payouts.projectId, projectId), eq(payouts.status, "failed")),
    )
    .orderBy(desc(payouts.scheduledAt))
    .limit(limit);
  return rows;
}

export interface ProjectMemberRow {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: ProjectRole;
  createdAt: Date;
}

export async function getProjectMembers(
  projectId: string,
): Promise<ProjectMemberRow[]> {
  const rows = await dbHttp
    .select({
      userId: projectMemberships.userId,
      name: users.name,
      email: users.email,
      image: users.image,
      role: projectMemberships.role,
      createdAt: projectMemberships.createdAt,
    })
    .from(projectMemberships)
    .innerJoin(users, eq(users.id, projectMemberships.userId))
    .where(eq(projectMemberships.projectId, projectId))
    .orderBy(desc(projectMemberships.createdAt));
  return rows;
}

// Re-export so callers don't have to dual-import.
export { or };
