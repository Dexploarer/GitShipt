import "server-only";
import { Octokit } from "@octokit/rest";
import { redis } from "@/lib/redis";
import {
  PublicRepoContributorSchema,
  PublicRepoContributorsSchema,
  type PublicRepoContributor,
} from "@repo/shared";

/**
 * Public-API contributor fetchers — no GitHub App installation required.
 *
 * Used by the "refresh real contributors" admin path to populate the
 * `contributors` table for projects that haven't installed the GitHub App
 * yet (e.g. SYMBaiEX/gitbags during the hackathon). The App-based indexer
 * is still the right path once installed; this is the fallback for public
 * repos when we just need a real list of contributors + their contribution
 * counts to show on the leaderboard.
 *
 * Returns an empty array on 404 / network failure so the caller can fall
 * back to whatever it has.
 */

const CACHE_PREFIX = "gh:contribs:";
const CACHE_TTL_SECONDS = 60 * 30; // 30 min

let _publicOctokit: Octokit | null = null;
function publicOctokit(): Octokit {
  if (_publicOctokit) return _publicOctokit;
  _publicOctokit = new Octokit();
  return _publicOctokit;
}

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
  const cacheKey = `${CACHE_PREFIX}${owner.toLowerCase()}/${repo.toLowerCase()}`;
  const r = redis();

  if (r) {
    try {
      const cached = await r.get(cacheKey);
      if (cached) return PublicRepoContributorsSchema.parse(JSON.parse(cached));
    } catch {
      // fall through to live fetch
    }
  }

  let result: PublicRepoContributor[] = [];
  try {
    const { data } = await publicOctokit().repos.listContributors({
      owner,
      repo,
      per_page: Math.min(100, Math.max(1, limit)),
      anon: "false",
    });
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
    const status = (e as { status?: number })?.status;
    if (status !== 404) {
      console.warn(`[gh:contribs:${owner}/${repo}] fetch failed`, e);
    }
    result = [];
  }

  if (r) {
    try {
      await r.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL_SECONDS);
    } catch {
      // non-fatal
    }
  }

  return result;
}
