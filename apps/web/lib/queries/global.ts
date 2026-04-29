import "server-only";
import { dbHttp } from "@/db";
import {
  projects,
  contributors,
  contributorClaims,
  payouts,
  payoutRecipients,
} from "@/db/schema";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { redis } from "@/lib/redis";
import { CACHE_SECONDS, cacheTags, getCachedValue } from "@/lib/cache";
import { z } from "zod";

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
  status:
    | "draft"
    | "launch_configured"
    | "live"
    | "paused"
    | "killed"
    | "simulated_live";
  contributorsCount: number;
  lifetimeFeesLamports: bigint;
  dailyFeeLamports: bigint;
}

export type LandingVolumeSource = "bags" | "unavailable";

export interface LandingTicker {
  /** Real Bags-derived 24h volume when the upstream data source exposes it. */
  volume24hUsd: number | null;
  /**
   * `bags` means `volume24hUsd` came from a real Bags market-data source.
   * `unavailable` keeps the landing honest instead of displaying simulations.
   */
  volumeSource: LandingVolumeSource;
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

export function hasRealLandingVolume(
  ticker: Pick<LandingTicker, "volume24hUsd" | "volumeSource">,
): ticker is Pick<LandingTicker, "volume24hUsd" | "volumeSource"> & {
  volume24hUsd: number;
  volumeSource: "bags";
} {
  return (
    ticker.volumeSource === "bags" &&
    typeof ticker.volume24hUsd === "number" &&
    Number.isFinite(ticker.volume24hUsd) &&
    ticker.volume24hUsd >= 0
  );
}

/**
 * Compute a per-project daily fee approximation from lifetime fees and
 * createdAt, matching the approach in `getPoolOverview` so numbers stay
 * coherent across surfaces.
 */
function dailyFromLifetime(lifetimeLamports: bigint, createdAt: Date): bigint {
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
async function getLandingDataUncached(): Promise<LandingData> {
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
    .orderBy(
      desc(
        sql`COALESCE(SUM(${payouts.totalAmountLamports}) FILTER (WHERE ${payouts.status} = 'completed'), 0)`,
      ),
    )
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

  // Prefer the cron-published Redis snapshot when present so the homepage
  // numbers match what's being broadcast across surfaces. The DB-derived
  // values above are the graceful fallback when Redis is empty / down.
  const cached = await getCachedLandingTicker();

  return {
    topProjects,
    ticker: cached ?? {
      volume24hUsd: null,
      volumeSource: "unavailable",
      lifetimeFeesLamports,
      activeProjects,
      contributorsEarning,
    },
  };
}

export function getLandingData(): Promise<LandingData> {
  return getCachedValue(getLandingDataUncached, ["gitshipt:landing-data:v2"], {
    tags: [cacheTags.public, cacheTags.landing],
    revalidate: CACHE_SECONDS.live,
  });
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
async function getGlobalLeaderboardUncached(): Promise<{
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
      // Only include contributors currently ranked on a project's leaderboard
      // (rank IS NOT NULL), and never the bot-excluded ones. Demoted
      // contributors keep their lifetime payout history but stop appearing
      // on the public global view.
      .where(
        and(isNotNull(contributors.rank), eq(contributors.excluded, "false")),
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
      .orderBy(
        desc(
          sql`COALESCE(SUM(${payouts.totalAmountLamports}) FILTER (WHERE ${payouts.status} = 'completed'), 0)`,
        ),
      )
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

export function getGlobalLeaderboard(): Promise<{
  byContributor: GlobalLeaderboardEntry[];
  byProject: GlobalProjectEntry[];
}> {
  return getCachedValue(
    getGlobalLeaderboardUncached,
    ["gitshipt:global-leaderboard:v1"],
    {
      tags: [cacheTags.public, cacheTags.globalLeaderboard],
      revalidate: CACHE_SECONDS.browse,
    },
  );
}

/**
 * Slim ticker-only fetch for any future client-side polling endpoint. Same
 * shape as `LandingTicker`. Currently unused (the landing's `<LiveTicker>`
 * receives its initial values from `getLandingData()` server-side), but
 * exposed so a `/api/ticker` route can wrap this without re-importing the
 * heavier `getLandingData`.
 */
export async function getLiveTickerDataUncached(): Promise<LandingTicker> {
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
  return {
    volume24hUsd: null,
    volumeSource: "unavailable",
    lifetimeFeesLamports,
    activeProjects: activeRows[0]?.count ?? 0,
    contributorsEarning: earningRows[0]?.count ?? 0,
  };
}

export function getLiveTickerData(): Promise<LandingTicker> {
  return getCachedValue(
    getLiveTickerDataUncached,
    ["gitshipt:live-ticker:v2"],
    {
      tags: [cacheTags.public, cacheTags.liveTicker, cacheTags.landing],
      revalidate: CACHE_SECONDS.live,
    },
  );
}

/**
 * Redis key + TTL where the `publishKpis` workflow drops its minute-level
 * snapshot of the landing ticker. Re-declared here (instead of imported
 * from `workflows/`) so this module stays free of workflow-runtime code
 * and can be pulled into RSCs without dragging in the workflow client.
 */
export const LANDING_TICKER_CACHE_KEY = "gitshipt:ticker:landing:v2";

const CachedLandingTickerPayloadSchema = z.object({
  ticker: z.object({
    volume24hUsd: z.number().nullable().optional(),
    volumeSource: z.enum(["bags", "unavailable"]).optional(),
    lifetimeFeesLamports: z.string(),
    activeProjects: z.number().int().min(0),
    contributorsEarning: z.number().int().min(0),
  }),
  publishedAt: z.string().min(1),
  stepId: z.string().optional(),
});

/**
 * Read the cron-published landing ticker snapshot from Redis. Returns
 * null on:
 *   - Redis not configured (stub mode)
 *   - cache miss (cold boot, key expired)
 *   - any parse / network error (logged, never throws — the caller falls
 *     back to a live DB read)
 */
export async function getCachedLandingTicker(): Promise<LandingTicker | null> {
  const r = redis();
  if (!r) return null;
  try {
    const raw = await r.get(LANDING_TICKER_CACHE_KEY);
    if (!raw) return null;
    const parsed = CachedLandingTickerPayloadSchema.parse(JSON.parse(raw));
    const volumeSource = parsed.ticker.volumeSource ?? "unavailable";
    const volume24hUsd =
      volumeSource === "bags" &&
      typeof parsed.ticker.volume24hUsd === "number" &&
      Number.isFinite(parsed.ticker.volume24hUsd) &&
      parsed.ticker.volume24hUsd >= 0
        ? parsed.ticker.volume24hUsd
        : null;
    return {
      volume24hUsd,
      volumeSource: volume24hUsd === null ? "unavailable" : "bags",
      lifetimeFeesLamports: BigInt(parsed.ticker.lifetimeFeesLamports ?? "0"),
      activeProjects: parsed.ticker.activeProjects ?? 0,
      contributorsEarning: parsed.ticker.contributorsEarning ?? 0,
    };
  } catch (err) {
    console.error(
      "[getCachedLandingTicker] read failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Convenience wrapper: prefer the Redis-cached snapshot; on miss, fall
 * back to a live `getLiveTickerData()` aggregate. Useful for any future
 * route that wants the ticker numbers without also fetching top projects.
 */
export async function getCachedTickerOrFresh(): Promise<LandingTicker> {
  const cached = await getCachedLandingTicker();
  if (cached) return cached;
  return getLiveTickerData();
}
