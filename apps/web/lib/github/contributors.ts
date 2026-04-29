import "server-only";
import { z } from "zod";
import { fetchGitHubJsonWithEtag } from "@/lib/github/http-cache";
import {
  PublicRepoContributorSchema,
  type PublicRepoContributor,
} from "@repo/shared";

/**
 * Public-API contributor fetchers — no GitHub App installation required.
 *
 * Used by the "refresh real contributors" admin path to populate the
 * `contributors` table for projects that haven't installed the GitHub App
 * yet (e.g. SYMBaiEX/gitshipt during the hackathon). The App-based indexer
 * is still the right path once installed; this is the fallback for public
 * repos when we just need a real list of contributors + their contribution
 * counts to show on the leaderboard.
 *
 * Returns an empty array on 404 / network failure so the caller can fall
 * back to whatever it has.
 */

const CACHE_PREFIX = "gh:contribs:";
const CACHE_TTL_SECONDS = 60 * 30; // 30 min

const GitHubContributorApiSchema = z.array(
  z
    .object({
      id: z.number().nullable().optional(),
      login: z.string().nullable().optional(),
      avatar_url: z.string().nullable().optional(),
      contributions: z.number().nullable().optional(),
      type: z.string().nullable().optional(),
    })
    .loose(),
);

/**
 * Fetches the top N contributors for a public repo via the listContributors
 * endpoint. Sorted by contribution count desc by GitHub. Bot accounts (type:
 * "Bot" + the dependabot/renovate family) are filtered out by the caller via
 * `lib/scoring/v0.isBot`.
 */
export async function fetchPublicRepoContributors(
  owner: string,
  repo: string,
  limit = 30,
): Promise<PublicRepoContributor[]> {
  if (!owner || !repo) return [];
  const normalizedOwner = owner.toLowerCase();
  const normalizedRepo = repo.toLowerCase();
  const safeLimit = Math.min(100, Math.max(1, limit));

  let result: PublicRepoContributor[] = [];
  try {
    const url = new URL(
      `https://api.github.com/repos/${encodeURIComponent(
        owner,
      )}/${encodeURIComponent(repo)}/contributors`,
    );
    url.searchParams.set("per_page", String(safeLimit));
    url.searchParams.set("anon", "false");
    const data = await fetchGitHubJsonWithEtag(
      `${CACHE_PREFIX}${normalizedOwner}/${normalizedRepo}:${safeLimit}`,
      url.toString(),
      GitHubContributorApiSchema,
      { ttlSeconds: CACHE_TTL_SECONDS },
    );
    result = data
      .filter((c) => c.type === "User" && c.login)
      .slice(0, limit)
      .map((c) =>
        PublicRepoContributorSchema.parse({
          ghUserId: String(c.id ?? ""),
          ghUsername: c.login!,
          avatarUrl: c.avatar_url ?? `https://github.com/${c.login}.png`,
          contributions: c.contributions ?? 0,
        }),
      );
  } catch (e) {
    console.warn(`[gh:contribs:${owner}/${repo}] fetch failed`, e);
    result = [];
  }

  return result;
}
