import "server-only";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { dbHttp } from "@/db";
import { projects } from "@/db/schema";

export const CACHE_SECONDS = {
  live: 60,
  browse: 120,
  profile: 300,
} as const;

export const cacheTags = {
  public: "gitbags:public",
  landing: "gitbags:landing",
  explore: "gitbags:explore",
  globalLeaderboard: "gitbags:global-leaderboard",
  liveTicker: "gitbags:live-ticker",
  project: (projectId: string) => `gitbags:project:${projectId}`,
  projectSlug: (slug: string) => `gitbags:project-slug:${slug}`,
  projectPayouts: (projectId: string) => `gitbags:project-payouts:${projectId}`,
  projectSnapshots: (projectId: string) => `gitbags:project-snapshots:${projectId}`,
  contributor: (username: string) => `gitbags:contributor:${username.toLowerCase()}`,
} as const;

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
    cacheTags.project(projectId),
    cacheTags.projectPayouts(projectId),
    cacheTags.projectSnapshots(projectId),
    ...(resolvedSlug ? [cacheTags.projectSlug(resolvedSlug)] : []),
  ]);
}

export function revalidateContributorCaches(usernames: Iterable<string>): void {
  revalidatePublicCaches();
  revalidateCacheTags(Array.from(usernames, (username) => cacheTags.contributor(username)));
}
