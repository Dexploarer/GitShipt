import "server-only";
import { eq, and, sql } from "drizzle-orm";

import { dbHttp } from "@/db";
import { projects, projectFeedEntries, snapshots } from "@/db/schema";
import { revalidateProjectCaches } from "@/lib/cache";

import { buildPeriodDigestSubjects } from "./inputs";
import { renderPeriodDigestMarkdown } from "./templates";

/**
 * Insert (or noop-on-conflict) a `period_digest` row for the given snapshot.
 *
 * Idempotent on `(project_id, kind, period)` UNIQUE: re-running the workflow
 * step (force-snapshot, retry, cron race) will not create duplicate rows.
 * Returns the row id whether newly inserted or pre-existing — callers that
 * don't care about the distinction can ignore the return.
 *
 * Reads the snapshot row inside the function so callers only need to pass
 * the snapshotId. Keeps the workflow step thin and avoids leaking the
 * leaderboard payload across step boundaries.
 */
export async function writePeriodDigestForSnapshot(
  snapshotId: string,
): Promise<{ inserted: boolean; entryId: string | null }> {
  const [snap] = await dbHttp
    .select({
      id: snapshots.id,
      projectId: snapshots.projectId,
      snapshotPeriod: snapshots.snapshotPeriod,
      leaderboard: snapshots.leaderboard,
    })
    .from(snapshots)
    .where(eq(snapshots.id, snapshotId))
    .limit(1);

  if (!snap) {
    return { inserted: false, entryId: null };
  }

  const [project] = await dbHttp
    .select({ slug: sql<string>`${projects.ghOwner} || '/' || ${projects.ghRepo}`, name: projects.name })
    .from(projects)
    .where(eq(projects.id, snap.projectId))
    .limit(1);

  // Project must still exist (cascading delete would have removed the
  // snapshot too, but we defend anyway in case ordering races during cleanup).
  if (!project) {
    return { inserted: false, entryId: null };
  }

  const subjects = buildPeriodDigestSubjects(
    snap.id,
    snap.snapshotPeriod,
    snap.leaderboard,
  );
  const bodyMd = renderPeriodDigestMarkdown(
    { slug: project.slug, name: project.name },
    subjects,
  );

  // ON CONFLICT DO NOTHING because the partial unique index on
  // (project_id, kind, period) WHERE period IS NOT NULL guarantees
  // dedup — re-running for the same period is a noop.
  const inserted = await dbHttp
    .insert(projectFeedEntries)
    .values({
      projectId: snap.projectId,
      kind: "period_digest",
      period: snap.snapshotPeriod,
      subjects,
      bodyMd,
    })
    .onConflictDoNothing({
      target: [
        projectFeedEntries.projectId,
        projectFeedEntries.kind,
        projectFeedEntries.period,
      ],
    })
    .returning({ id: projectFeedEntries.id });

  if (inserted.length > 0) {
    // Bump the project's caches so a freshly-rendered feed page picks up
    // the new card without waiting for the snapshot's own revalidation.
    await revalidateProjectCaches(snap.projectId);
    return { inserted: true, entryId: inserted[0]!.id };
  }

  // Fall through: row already existed for this period. Look it up so the
  // caller (and audit log) has the id.
  const [existing] = await dbHttp
    .select({ id: projectFeedEntries.id })
    .from(projectFeedEntries)
    .where(
      and(
        eq(projectFeedEntries.projectId, snap.projectId),
        eq(projectFeedEntries.kind, "period_digest"),
        eq(projectFeedEntries.period, snap.snapshotPeriod),
      ),
    )
    .limit(1);

  return { inserted: false, entryId: existing?.id ?? null };
}
