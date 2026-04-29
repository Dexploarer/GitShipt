import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { dbHttp } from "@/db";
import { projects } from "@/db/schema";

type CachePayload =
  | null
  | boolean
  | number
  | string
  | CachePayload[]
  | { [key: string]: CachePayload };

const CACHE_TYPE_KEY = "__gitshipt_cache_type";
const CACHE_VALUE_KEY = "value";

export const CACHE_SECONDS = {
  live: 60,
  auth: 30,
  admin: 30,
  browse: 120,
  profile: 300,
} as const;

export const cacheTags = {
  public: "gitshipt:public",
  landing: "gitshipt:landing",
  explore: "gitshipt:explore",
  globalLeaderboard: "gitshipt:global-leaderboard",
  liveTicker: "gitshipt:live-ticker",
  launch: "gitshipt:launch",
  dashboard: "gitshipt:dashboard",
  admin: "gitshipt:admin",
  adminAudit: "gitshipt:admin-audit",
  adminUsers: "gitshipt:admin-users",
  platformConfig: "gitshipt:platform-config",
  user: (userId: string) => `gitshipt:user:${userId}`,
  dashboardUser: (userId: string) => `gitshipt:dashboard-user:${userId}`,
  dashboardProject: (projectId: string) =>
    `gitshipt:dashboard-project:${projectId}`,
  project: (projectId: string) => `gitshipt:project:${projectId}`,
  projectSlug: (slug: string) => `gitshipt:project-slug:${slug}`,
  projectPayouts: (projectId: string) => `gitshipt:project-payouts:${projectId}`,
  projectSnapshots: (projectId: string) =>
    `gitshipt:project-snapshots:${projectId}`,
  contributor: (username: string) =>
    `gitshipt:contributor:${username.toLowerCase()}`,
  githubUser: (username: string) =>
    `gitshipt:github-user:${username.toLowerCase()}`,
} as const;

interface CachedValueOptions {
  tags: string[];
  revalidate: number | false;
}

export async function getCachedValue<T>(
  loader: () => Promise<T>,
  keyParts: string[],
  options: CachedValueOptions,
): Promise<T> {
  const payload = await unstable_cache(
    async () => toCachePayload(await loader()),
    keyParts,
    options,
  )();
  return fromCachePayload<T>(payload);
}

function toCachePayload(value: unknown): CachePayload {
  if (value == null) return null;
  if (typeof value === "bigint") {
    return {
      [CACHE_TYPE_KEY]: "bigint",
      [CACHE_VALUE_KEY]: value.toString(),
    };
  }
  if (value instanceof Date) {
    return {
      [CACHE_TYPE_KEY]: "date",
      [CACHE_VALUE_KEY]: value.toISOString(),
    };
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toCachePayload(item));
  }
  if (typeof value === "object") {
    const out: { [key: string]: CachePayload } = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      out[key] = toCachePayload(item);
    }
    return out;
  }
  throw new TypeError(`Unsupported cache payload value: ${typeof value}`);
}

function fromCachePayload<T>(payload: CachePayload): T {
  return reviveCachePayload(payload) as T;
}

function reviveCachePayload(payload: CachePayload): unknown {
  if (payload == null) return null;
  if (Array.isArray(payload)) {
    return payload.map((item) => reviveCachePayload(item));
  }
  if (typeof payload !== "object") {
    return payload;
  }

  const type = payload[CACHE_TYPE_KEY];
  const value = payload[CACHE_VALUE_KEY];
  if (type === "bigint" && typeof value === "string") {
    return BigInt(value);
  }
  if (type === "date" && typeof value === "string") {
    return new Date(value);
  }

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(payload)) {
    out[key] = reviveCachePayload(item);
  }
  return out;
}

export function revalidateCacheTags(tags: Iterable<string>): void {
  for (const tag of new Set(tags)) {
    revalidateTag(tag, "max");
  }
}

export function revalidatePublicCaches(): void {
  revalidateCacheTags([
    cacheTags.public,
    cacheTags.landing,
    cacheTags.explore,
    cacheTags.globalLeaderboard,
    cacheTags.liveTicker,
    cacheTags.launch,
  ]);
}

export function revalidateAdminCaches(): void {
  revalidateCacheTags([
    cacheTags.admin,
    cacheTags.adminAudit,
    cacheTags.adminUsers,
    cacheTags.platformConfig,
  ]);
}

export function revalidateUserCaches(userId: string): void {
  revalidateCacheTags([
    cacheTags.dashboard,
    cacheTags.user(userId),
    cacheTags.dashboardUser(userId),
  ]);
}

export async function revalidateProjectCaches(
  projectId: string,
  slug?: string,
): Promise<void> {
  let resolvedSlug = slug;
  if (!resolvedSlug) {
    const [row] = await dbHttp
      .select({ ghOwner: projects.ghOwner, ghRepo: projects.ghRepo })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (row) resolvedSlug = `${row.ghOwner}/${row.ghRepo}`;
  }

  revalidatePublicCaches();
  revalidateCacheTags([
    cacheTags.dashboard,
    cacheTags.admin,
    cacheTags.project(projectId),
    cacheTags.dashboardProject(projectId),
    cacheTags.projectPayouts(projectId),
    cacheTags.projectSnapshots(projectId),
    ...(resolvedSlug ? [cacheTags.projectSlug(resolvedSlug)] : []),
  ]);
}

export function revalidateContributorCaches(usernames: Iterable<string>): void {
  revalidatePublicCaches();
  revalidateCacheTags(
    Array.from(usernames, (username) => cacheTags.contributor(username)),
  );
}
