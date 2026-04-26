import "server-only";
import { dbHttp } from "@/db";
import { contributors, projects } from "@/db/schema";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { fetchPublicRepoContributors } from "@/lib/github/contributors";
import { getGitHubUser } from "@/lib/github/users";
import {
  DEFAULT_WEIGHTS,
  computeRawScore,
  isBot,
} from "@/lib/scoring/v0";

export interface RefreshContributorsResult {
  projectId: string;
  slug: string;
  fetched: number;
  upserted: number;
  removed: number;
  topContributors: Array<{
    rank: number;
    ghUsername: string;
    score: number;
    commits: number;
  }>;
}

/**
 * Replace a project's `contributors` rows with the real GitHub contributor
 * list for its repo. Falls back to the public listContributors endpoint
 * (no GitHub App installation needed) so this works for any public repo
 * even before the GitHub App is installed.
 *
 * Steps:
 *  1. Resolve the project by id.
 *  2. Fetch the top N contributors from GitHub (public API).
 *  3. Filter out bots via the project's scoringConfig allow/blocklists.
 *  4. Compute v0 scores from real commit counts (PRs/reviews/issues are
 *     unknown via the public contributors endpoint — set to 0; the
 *     App-based indexer will fill those in once installed).
 *  5. Rank top topN, upsert into contributors, clear rank+score for any
 *     existing row that's no longer in the top set.
 *
 * Idempotent. Safe to re-run.
 */
export async function refreshProjectContributors(
  projectId: string,
  options: { topN?: number } = {},
): Promise<RefreshContributorsResult> {
  const [project] = await dbHttp
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const topN = options.topN ?? project.payoutConfig.topN ?? 10;
  let fetched = await fetchPublicRepoContributors(
    project.ghOwner,
    project.ghRepo,
    Math.max(50, topN * 3),
  );

  // Private-repo / 404 fallback: when GitHub returns no contributors (the
  // repo is private, missing, or rate-limited under unauthenticated quota),
  // synthesize a single-row "owner-as-contributor" entry from the owner's
  // public user profile. This keeps the leaderboard showing real GitHub
  // identity (avatar, name, profile link) instead of nothing while the
  // operator sets up either a PAT or a GitHub App installation for the
  // repo. Once either lands, the next refresh replaces this row with the
  // real top-N contributors.
  if (fetched.length === 0) {
    const ownerProfile = await getGitHubUser(project.ghOwner);
    if (ownerProfile) {
      fetched = [
        {
          ghUserId: String(ownerProfile.id),
          ghUsername: ownerProfile.login,
          avatarUrl: ownerProfile.avatarUrl,
          contributions: 1,
        },
      ];
    }
  }

  const allowlist = project.scoringConfig.botAllowlist ?? [];
  const blocklist = project.scoringConfig.botBlocklist ?? [];
  const weights = project.scoringConfig.weights ?? DEFAULT_WEIGHTS;

  // Filter bots, score with what the public API exposes (commits only).
  const ranked = fetched
    .filter((c) => !isBot(c.ghUsername, allowlist, blocklist))
    .map((c) => {
      const inputs = {
        mergedPRs: 0,
        commits: c.contributions,
        reviews: 0,
        issues: 0,
        netLines: 0,
      };
      return {
        ...c,
        inputs,
        score: computeRawScore(inputs, weights),
      };
    })
    .sort((a, b) => b.score - a.score);

  const indexedAt = new Date();
  const top = ranked.slice(0, topN);

  // Resolve any missing ghUserIds + better avatars via the public user
  // endpoint when the contributors response didn't include them. This is a
  // best-effort enrichment; failures fall back to whatever we have.
  await Promise.all(
    top.map(async (c, i) => {
      if (!c.ghUserId || c.ghUserId === "0") {
        const u = await getGitHubUser(c.ghUsername);
        if (u) {
          top[i] = {
            ...c,
            ghUserId: String(u.id),
            avatarUrl: u.avatarUrl,
          };
        } else {
          top[i] = { ...c, ghUserId: c.ghUsername.toLowerCase() };
        }
      }
    }),
  );

  // Upsert each ranked contributor with rank + score.
  for (let i = 0; i < top.length; i++) {
    const c = top[i]!;
    await dbHttp
      .insert(contributors)
      .values({
        projectId: project.id,
        ghUserId: c.ghUserId,
        ghUsername: c.ghUsername,
        avatarUrl: c.avatarUrl,
        score: c.score,
        rank: i + 1,
        inputs: c.inputs,
        excluded: "false",
        excludedReason: null,
        lastIndexedAt: indexedAt,
      })
      .onConflictDoUpdate({
        target: [contributors.projectId, contributors.ghUserId],
        set: {
          ghUsername: c.ghUsername,
          avatarUrl: c.avatarUrl,
          score: c.score,
          rank: i + 1,
          inputs: sql`excluded.inputs`,
          excluded: "false",
          excludedReason: null,
          lastIndexedAt: indexedAt,
        },
      });
  }

  // Demote any rows that were ranked previously but aren't in the new top
  // set — clear their rank so they fall off the leaderboard. We keep the
  // row so per-contributor lifetime payout history stays intact.
  const keepIds = top.map((c) => c.ghUserId);
  if (keepIds.length > 0) {
    await dbHttp
      .update(contributors)
      .set({ rank: null, lastIndexedAt: indexedAt })
      .where(
        and(
          eq(contributors.projectId, project.id),
          notInArray(contributors.ghUserId, keepIds),
        ),
      );
  }

  // Count rows we just demoted (best-effort metric for the response).
  const demotedRows = await dbHttp
    .select({ id: contributors.id })
    .from(contributors)
    .where(
      and(
        eq(contributors.projectId, project.id),
        sql`${contributors.rank} is null`,
      ),
    );

  return {
    projectId: project.id,
    slug: `${project.ghOwner}/${project.ghRepo}`,
    fetched: fetched.length,
    upserted: top.length,
    removed: demotedRows.length,
    topContributors: top.map((c, i) => ({
      rank: i + 1,
      ghUsername: c.ghUsername,
      score: Math.round(c.score),
      commits: c.contributions,
    })),
  };
}
