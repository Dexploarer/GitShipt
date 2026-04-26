"use server";

import { updateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { dbHttp } from "@/db";
import { projects } from "@/db/schema";
import { cacheTags } from "@/lib/cache";

function updateCacheTags(tags: Iterable<string>): void {
  for (const tag of new Set(tags)) {
    updateTag(tag);
  }
}

export async function updatePublicCaches(): Promise<void> {
  updateCacheTags([
    cacheTags.public,
    cacheTags.landing,
    cacheTags.explore,
    cacheTags.globalLeaderboard,
    cacheTags.liveTicker,
  ]);
}

export async function updateProjectCaches(
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

  await updatePublicCaches();
  updateCacheTags([
    cacheTags.project(projectId),
    cacheTags.projectPayouts(projectId),
    cacheTags.projectSnapshots(projectId),
    ...(resolvedSlug ? [cacheTags.projectSlug(resolvedSlug)] : []),
  ]);
}
