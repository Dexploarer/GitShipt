import "server-only";
import { dbHttp } from "@/db";
import {
  projects,
  contributors,
  contributorClaims,
  payouts,
  payoutRecipients,
  wallets,
} from "@/db/schema";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

/**
 * Public marketing data layer. Powers the landing hero ticker, the Top
 * Projects grid, the global leaderboard (cross-project), and any other
 * surface that aggregates across all live projects.
 *
 * Every function is a single-shot read using `dbHttp`. Designed to be
 * safe to call from RSCs and to gracefully return zeroed/empty values
 * when the database is empty (Day-0 demo state).
 */

export interface LandingProject {
  id: string;
  slug: string; // `${ghOwner}/${ghRepo}`
  ghOwner: string;
  ghRepo: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  status: "draft" | "live" | "paused" | "killed";
  contributorsCount: number;
  lifetimeFeesLamports: bigint;
  dailyFeeLamports: bigint;
}

export interface LandingTicker {
  /** Sum of stub-derived 24h volume across live projects. */
  volume24hUsd: number;
  /** SUM(payouts.total_amount_lamports) WHERE status='completed'. */
  lifetimeFeesLamports: bigint;
  /** COUNT(projects WHERE status='live'). */
  activeProjects: number;
  /** COUNT(DISTINCT contributorClaims rows with wallet_address NOT NULL). */
  contributorsEarning: number;
}

export interface LandingData {
  topProjects: LandingProject[];
  ticker: LandingTicker;
}

export interface GlobalLeaderboardEntry {
  rank: number;
  ghUsername: string;
  ghUserId: string | null;
  avatarUrl: string;
  totalLifetimeLamports: bigint;
  activeProjectsCount: number;
  topProjectSlug: string;
}

export interface GlobalProjectEntry {
  rank: number;
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  lifetimeFeesLamports: bigint;
  dailyFeeLamports: bigint;
  contributorsPaid: number;
}

/**
 * Lamports per SOL (kept local so this module has no other deps).
 */
const LAMPORTS_PER_SOL = 1_000_000_000n;

/**
 * Convert a bigint lamports value to a number of SOL (lossy for very large
 * values but fine for the demo + display scale).
 */
function lamportsToSolNumber(lamports: bigint): number {
  return Number(lamports) / Number(LAMPORTS_PER_SOL);
}

/**
 * Deterministic 24h volume stub mirroring `lib/queries/token-stats.ts`.
 * Real Bags volume isn't exposed yet — when it is, swap this for a sum
 * over `tokenStats.volume24hUsd` per project.
 *
 * Same scaling factor as token-stats.ts: priceUsd × 25_000_000, where
 * priceUsd = lifetimeSol / 100_000.
 */
function stubVolume24hUsd(lifetimeLamports: bigint): number {
  const lifetimeSol = lamportsToSolNumber(lifetimeLamports);
  const priceUsd = lifetimeSol / 100_000 || 0.00001;
  return priceUsd * 25_000_000;
}

/**
 * Compute a per-project daily fee approximation from lifetime fees and
 * createdAt, matching the approach in `getPoolOverview` so numbers stay
 * coherent across surfaces.
 */
function dailyFromLifetime(
  lifetimeLamports: bigint,
  createdAt: Date,
): bigint {
  const days = Math.max(
    1,
    Math.floor((Date.now() - createdAt.getTime()) / 86_400_000),
  );
  return lifetimeLamports / BigInt(days);
}

/**
 * Top projects + global ticker for the landing page. Single round-trip
 * to the DB for each piece; ticker aggregates run as a few small COUNTs
 * + SUMs and should be sub-100ms even on a cold pool.
 */
export async function getLandingData(): Promise<LandingData> {
  // Top 9 live projects, ranked by computed lifetime fees from the payouts
  // table (the canonical on-chain truth). LEFT JOIN so projects with zero
  // payouts still surface (they're the freshest launches).
  const topRows = await dbHttp
    .select({
      id: projects.id,
      ghOwner: projects.ghOwner,
      ghRepo: projects.ghRepo,
      name: projects.name,
      description: projects.description,
      imageUrl: projects.imageUrl,
      status: projects.status,
      createdAt: projects.createdAt,
      lifetimeFeesLamports: sql<string>`COALESCE(SUM(${payouts.totalAmountLamports}) FILTER (WHERE ${payouts.status} = 'completed'), 0)::text`,
      contributorsCount: sql<number>`(SELECT COUNT(*)::int FROM ${contributors} WHERE ${contributors.projectId} = ${projects.id})`,
    })
    .from(projects)
    .leftJoin(payouts, eq(payouts.projectId, projects.id))
    .where(eq(projects.status, "live"))
    .groupBy(projects.id)
    .orderBy(desc(sql`COALESCE(SUM(${payouts.totalAmountLamports}) FILTER (WHERE ${payouts.status} = 'completed'), 0)`))
    .limit(9);

  const topProjects: LandingProject[] = topRows.map((r) => {
    const lifetime = BigInt(r.lifetimeFeesLamports);
    return {
      id: r.id,
      slug: `${r.ghOwner}/${r.ghRepo}`,
      ghOwner: r.ghOwner,
      ghRepo: r.ghRepo,
      name: r.name,
      description: r.description,
      imageUrl: r.imageUrl,
      status: r.status,
      contributorsCount: r.contributorsCount ?? 0,
      lifetimeFeesLamports: lifetime,
      dailyFeeLamports: dailyFromLifetime(lifetime, r.createdAt),
    };
  });

  // Ticker aggregates — three small queries in parallel.
  const [feesRows, activeRows, earningRows] = await Promise.all([
    dbHttp
      .select({
        sum: sql<string>`COALESCE(SUM(${payouts.totalAmountLamports}), 0)::text`,
      })
      .from(payouts)
      .where(eq(payouts.status, "completed")),
    dbHttp
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(projects)
      .where(eq(projects.status, "live")),
    dbHttp
      .select({
        count: sql<number>`COUNT(DISTINCT ${contributorClaims.contributorId})::int`,
      })
      .from(contributorClaims)
      .where(isNotNull(contributorClaims.walletAddress)),
  ]);

  const lifetimeFeesLamports = BigInt(feesRows[0]?.sum ?? "0");
  const activeProjects = activeRows[0]?.count ?? 0;
  const contributorsEarning = earningRows[0]?.count ?? 0;

  // 24h volume — sum of stubs across the top projects so the headline
  // number scales with the demo data. TODO: swap for a real Bags volume
  // sum once the API exposes per-token rolling volume.
  const volume24hUsd = topProjects.reduce(
    (acc, p) => acc + stubVolume24hUsd(p.lifetimeFeesLamports),
    0,
  );

  return {
    topProjects,
    ticker: {
      volume24hUsd,
      lifetimeFeesLamports,
      activeProjects,
      contributorsEarning,
    },
  };
}

/**
 * Global cross-project leaderboard. Returns two views computed in parallel
 * so the page can switch tabs without a second round-trip.
 *
 * `byContributor`: each GitHub user's lifetime SOL across every project,
 * computed from confirmed `payout_recipients` rows. Joined to a derived
 * "top project" (the project where they've earned the most) so the row
 * surfaces a primary affiliation without an N+1.
 *
 * `byProject`: each project's lifetime fees + distinct paid contributor
 * count, derived from completed payouts.
 */
export async function getGlobalLeaderboard(): Promise<{
  byContributor: GlobalLeaderboardEntry[];
  byProject: GlobalProjectEntry[];
}> {
  const [contributorRows, projectRows] = await Promise.all([
    // Per (project, ghUsername) aggregate, then we collapse to per-username
    // in JS so we can pick the top project without a window function.
    dbHttp
      .select({
        ghUsername: contributors.ghUsername,
        ghUserId: contributors.ghUserId,
        avatarUrl: contributors.avatarUrl,
        projectId: contributors.projectId,
        projectGhOwner: projects.ghOwner,
        projectGhRepo: projects.ghRepo,
        sumLamports: sql<string>`COALESCE(SUM(${payoutRecipients.amountLamports}) FILTER (WHERE ${payoutRecipients.status} = 'confirmed'), 0)::text`,
      })
      .from(contributors)
      .innerJoin(projects, eq(projects.id, contributors.projectId))
      .leftJoin(
        payoutRecipients,
        eq(payoutRecipients.contributorId, contributors.id),
      )
      .groupBy(
        contributors.ghUsername,
        contributors.ghUserId,
        contributors.avatarUrl,
        contributors.projectId,
        projects.ghOwner,
        projects.ghRepo,
      ),
    dbHttp
      .select({
        id: projects.id,
        ghOwner: projects.ghOwner,
        ghRepo: projects.ghRepo,
        name: projects.name,
        imageUrl: projects.imageUrl,
        createdAt: projects.createdAt,
        lifetimeFeesLamports: sql<string>`COALESCE(SUM(${payouts.totalAmountLamports}) FILTER (WHERE ${payouts.status} = 'completed'), 0)::text`,
        contributorsPaid: sql<number>`COALESCE((
          SELECT COUNT(DISTINCT ${payoutRecipients.contributorId})::int
          FROM ${payoutRecipients}
          INNER JOIN ${payouts} p2 ON p2.id = ${payoutRecipients.payoutId}
          WHERE p2.project_id = ${projects.id}
            AND ${payoutRecipients.status} = 'confirmed'
        ), 0)`,
      })
      .from(projects)
      .leftJoin(payouts, eq(payouts.projectId, projects.id))
      .where(eq(projects.status, "live"))
      .groupBy(projects.id)
      .orderBy(desc(sql`COALESCE(SUM(${payouts.totalAmountLamports}) FILTER (WHERE ${payouts.status} = 'completed'), 0)`))
      .limit(50),
  ]);

  // Collapse contributor rows by username, tracking total + per-project
  // contributions so we can pick the top project for each.
  type Bucket = {
    ghUsername: string;
    ghUserId: string | null;
    avatarUrl: string | null;
    total: bigint;
    perProject: Map<string, { lamports: bigint; slug: string }>;
  };
  const buckets = new Map<string, Bucket>();
  for (const r of contributorRows) {
    const lamports = BigInt(r.sumLamports);
    const slug = `${r.projectGhOwner}/${r.projectGhRepo}`;
    let bucket = buckets.get(r.ghUsername);
    if (!bucket) {
      bucket = {
        ghUsername: r.ghUsername,
        ghUserId: r.ghUserId,
        avatarUrl: r.avatarUrl,
        total: 0n,
        perProject: new Map(),
      };
      buckets.set(r.ghUsername, bucket);
    }
    bucket.total += lamports;
    const existing = bucket.perProject.get(r.projectId);
    if (existing) {
      existing.lamports += lamports;
    } else {
      bucket.perProject.set(r.projectId, { lamports, slug });
    }
  }

  const byContributor: GlobalLeaderboardEntry[] = Array.from(buckets.values())
    .map((b) => {
      let topSlug = "";
      let topLamports = -1n;
      let activeProjectsCount = 0;
      for (const proj of b.perProject.values()) {
        activeProjectsCount += 1;
        if (proj.lamports > topLamports) {
          topLamports = proj.lamports;
          topSlug = proj.slug;
        }
      }
      return {
        ghUsername: b.ghUsername,
        ghUserId: b.ghUserId,
        avatarUrl: b.avatarUrl ?? `https://github.com/${b.ghUsername}.png`,
        totalLifetimeLamports: b.total,
        activeProjectsCount,
        topProjectSlug: topSlug,
        rank: 0, // assigned below
      };
    })
    .sort((a, z) => {
      if (z.totalLifetimeLamports > a.totalLifetimeLamports) return 1;
      if (z.totalLifetimeLamports < a.totalLifetimeLamports) return -1;
      return a.ghUsername.localeCompare(z.ghUsername);
    })
    .slice(0, 50)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  const byProject: GlobalProjectEntry[] = projectRows.map((r, i) => {
    const lifetime = BigInt(r.lifetimeFeesLamports);
    return {
      rank: i + 1,
      id: r.id,
      slug: `${r.ghOwner}/${r.ghRepo}`,
      name: r.name,
      imageUrl: r.imageUrl,
      lifetimeFeesLamports: lifetime,
      dailyFeeLamports: dailyFromLifetime(lifetime, r.createdAt),
      contributorsPaid: r.contributorsPaid ?? 0,
    };
  });

  return { byContributor, byProject };
}

/**
 * Slim ticker-only fetch for any future client-side polling endpoint. Same
 * shape as `LandingTicker`. Currently unused (the landing's `<LiveTicker>`
 * receives its initial values from `getLandingData()` server-side and just
 * animates them client-side), but exposed so a `/api/ticker` route can wrap
 * this without re-importing the heavier `getLandingData`.
 */
export async function getLiveTickerData(): Promise<LandingTicker> {
  const [feesRows, activeRows, earningRows, walletRows] = await Promise.all([
    dbHttp
      .select({
        sum: sql<string>`COALESCE(SUM(${payouts.totalAmountLamports}), 0)::text`,
      })
      .from(payouts)
      .where(eq(payouts.status, "completed")),
    dbHttp
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(projects)
      .where(eq(projects.status, "live")),
    dbHttp
      .select({
        count: sql<number>`COUNT(DISTINCT ${contributorClaims.contributorId})::int`,
      })
      .from(contributorClaims)
      .where(isNotNull(contributorClaims.walletAddress)),
    // Sum of stub volume — same shape as getLandingData but without the
    // top projects payload.
    dbHttp
      .select({
        sum: sql<string>`COALESCE(SUM(${payouts.totalAmountLamports}) FILTER (WHERE ${payouts.status} = 'completed'), 0)::text`,
      })
      .from(payouts)
      .innerJoin(projects, and(eq(projects.id, payouts.projectId), eq(projects.status, "live"))),
  ]);

  const lifetimeFeesLamports = BigInt(feesRows[0]?.sum ?? "0");
  const liveLamports = BigInt(walletRows[0]?.sum ?? "0");
  return {
    volume24hUsd: stubVolume24hUsd(liveLamports),
    lifetimeFeesLamports,
    activeProjects: activeRows[0]?.count ?? 0,
    contributorsEarning: earningRows[0]?.count ?? 0,
  };
}
