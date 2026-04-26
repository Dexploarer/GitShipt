import { dbHttp } from "@/db";
import { contributors } from "@/db/schema";
import { sql } from "drizzle-orm";
import type { ContributorAggregate } from "@/lib/github/indexer";

/**
 * Step helper — upsert a batch of contributor aggregates for a project.
 * Conflict target is `(project_id, gh_user_id)`. Updates `inputs`,
 * username/avatar, and `last_indexed_at`. Excluded contributors keep
 * their excluded flag (only username/inputs refresh).
 */
export async function stepUpsertContributors(
  projectId: string,
  aggregates: ContributorAggregate[],
): Promise<{ count: number }> {
  "use step";
  if (aggregates.length === 0) return { count: 0 };

  const now = new Date();
  const rows = aggregates.map((a) => ({
    projectId,
    ghUserId: a.ghUserId,
    ghUsername: a.ghUsername,
    avatarUrl: a.avatarUrl,
    inputs: a.inputs,
    excluded: a.isBot ? "true" : "false",
    excludedReason: a.isBot ? "bot_detected" : null,
    lastIndexedAt: now,
  }));

  await dbHttp
    .insert(contributors)
    .values(rows)
    .onConflictDoUpdate({
      target: [contributors.projectId, contributors.ghUserId],
      set: {
        ghUsername: sql`excluded.gh_username`,
        avatarUrl: sql`excluded.avatar_url`,
        inputs: sql`excluded.inputs`,
        lastIndexedAt: sql`excluded.last_indexed_at`,
      },
    });

  return { count: aggregates.length };
}
