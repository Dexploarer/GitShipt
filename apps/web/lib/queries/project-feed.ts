import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { dbHttp } from "@/db";
import { projectFeedEntries, type FeedEntrySubjects } from "@/db/schema";
import { cacheTags, revalidateProjectCaches } from "@/lib/cache";

/**
 * Public feed reads. Backs /r/[org]/[repo]/feed and /r/[org]/[repo]/feed.atom.
 *
 * Cards are written by takeProjectSnapshot via lib/feed/writer; this module
 * only reads them. `cacheLife("browse")` matches the explore page (≤120s
 * revalidate) — the feed updates at snapshot cadence (daily by default), so
 * a 2-minute stale window is invisible in practice.
 */

export interface ProjectFeedRow {
  id: string;
  kind:
    | "period_digest"
    | "first_contributor"
    | "score_threshold"
    | "first_payout";
  period: string | null;
  subjects: FeedEntrySubjects;
  bodyMd: string;
  pinnedUntil: Date | null;
  pinned: boolean;
  createdAt: Date;
}

const activePinSql = sql<boolean>`${projectFeedEntries.pinnedUntil} IS NOT NULL
  AND ${projectFeedEntries.pinnedUntil} > now()`;

async function getProjectFeedUncached(
  projectId: string,
  limit: number,
): Promise<ProjectFeedRow[]> {
  // Pinned (pinned_until > now()) first, then newest by created_at.
  // Avoids a UNION by using a CASE expression in ORDER BY.
  const rows = await dbHttp
    .select({
      id: projectFeedEntries.id,
      kind: projectFeedEntries.kind,
      period: projectFeedEntries.period,
      subjects: projectFeedEntries.subjects,
      bodyMd: projectFeedEntries.bodyMd,
      pinnedUntil: projectFeedEntries.pinnedUntil,
      pinned: activePinSql,
      createdAt: projectFeedEntries.createdAt,
    })
    .from(projectFeedEntries)
    .where(eq(projectFeedEntries.projectId, projectId))
    .orderBy(
      sql`CASE WHEN ${activePinSql} THEN 0 ELSE 1 END`,
      desc(projectFeedEntries.createdAt),
    )
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    period: r.period,
    subjects: r.subjects,
    bodyMd: r.bodyMd,
    pinnedUntil: r.pinnedUntil,
    pinned: Boolean(r.pinned),
    createdAt: r.createdAt,
  }));
}

async function getProjectFeedAtomUncached(
  projectId: string,
  limit: number,
): Promise<ProjectFeedRow[]> {
  const rows = await dbHttp
    .select({
      id: projectFeedEntries.id,
      kind: projectFeedEntries.kind,
      period: projectFeedEntries.period,
      subjects: projectFeedEntries.subjects,
      bodyMd: projectFeedEntries.bodyMd,
      pinnedUntil: projectFeedEntries.pinnedUntil,
      pinned: activePinSql,
      createdAt: projectFeedEntries.createdAt,
    })
    .from(projectFeedEntries)
    .where(
      and(
        eq(projectFeedEntries.projectId, projectId),
        sql`length(trim(${projectFeedEntries.bodyMd})) > 0`,
        sql`${projectFeedEntries.createdAt} > now() - interval '90 days'`,
      ),
    )
    .orderBy(desc(projectFeedEntries.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    period: r.period,
    subjects: r.subjects,
    bodyMd: r.bodyMd,
    pinnedUntil: r.pinnedUntil,
    pinned: Boolean(r.pinned),
    createdAt: r.createdAt,
  }));
}

export async function getProjectFeed(
  projectId: string,
  limit = 50,
): Promise<ProjectFeedRow[]> {
  "use cache";
  cacheLife("browse");
  cacheTag(cacheTags.public);
  cacheTag(cacheTags.project(projectId));
  return await getProjectFeedUncached(projectId, limit);
}

/**
 * Pin or unpin a feed entry. Server Action surface — caller must be the
 * project owner or admin. Re-validates project caches so the public feed
 * page picks up the new pin order on the next render.
 *
 * `pinnedUntil = null` clears the pin.
 */
export async function setFeedEntryPin(
  entryId: string,
  pinnedUntil: Date | null,
): Promise<{ ok: boolean }> {
  // Single-row update, no row-level filters beyond id (callers are expected
  // to enforce project ownership upstream via requirePermission).
  const result = await dbHttp
    .update(projectFeedEntries)
    .set({ pinnedUntil })
    .where(eq(projectFeedEntries.id, entryId))
    .returning({
      id: projectFeedEntries.id,
      projectId: projectFeedEntries.projectId,
    });
  const [updated] = result;
  if (!updated) return { ok: false };

  await revalidateProjectCaches(updated.projectId);
  return { ok: true };
}

/**
 * Atom feed needs the project's slug + name plus the recent entries — one
 * round-trip for the cron path.
 */
export async function getProjectFeedAtomData(
  projectId: string,
  limit = 30,
): Promise<{
  entries: ProjectFeedRow[];
  /** Pre-filtered to entries that should appear in atom (skips empty bodies). */
  validCount: number;
}> {
  "use cache";
  cacheLife("browse");
  cacheTag(cacheTags.public);
  cacheTag(cacheTags.project(projectId));
  const valid = await getProjectFeedAtomUncached(projectId, limit);
  return {
    entries: valid,
    validCount: valid.length,
  };
}
