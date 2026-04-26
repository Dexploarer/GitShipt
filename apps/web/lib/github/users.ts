import "server-only";
import { Octokit } from "@octokit/rest";
import { redis } from "@/lib/redis";
import {
  GitHubUserProfileCacheSchema,
  GitHubUserProfileSchema,
  type GitHubUserProfile,
} from "@repo/shared";

export type { GitHubUserProfile };

/**
 * Public GitHub user profile fetcher with a 30-minute Redis cache.
 *
 * Uses the unauthenticated REST API (60 req/hr per IP) by default. When the
 * GitHub App credentials are configured, we'll fall back to an installation-
 * scoped Octokit for higher rate limits — but for the public profile surface
 * the unauthenticated client is fine and avoids dragging the App auth path
 * onto every page load.
 *
 * Returns `null` when the user doesn't exist (404) or any non-network error
 * occurs — the caller should treat this as "no GitHub data available" and
 * fall back to whatever it has from our DB.
 */

const CACHE_PREFIX = "gh:user:";
const CACHE_TTL_SECONDS = 60 * 30; // 30 minutes

let _publicOctokit: Octokit | null = null;
function publicOctokit(): Octokit {
  if (_publicOctokit) return _publicOctokit;
  _publicOctokit = new Octokit();
  return _publicOctokit;
}

export async function getGitHubUser(
  username: string,
): Promise<GitHubUserProfile | null> {
  if (!username) return null;

  const cacheKey = `${CACHE_PREFIX}${username.toLowerCase()}`;
  const r = redis();

  if (r) {
    try {
      const cached = await r.get(cacheKey);
      if (cached) {
        const parsed = GitHubUserProfileCacheSchema.parse(JSON.parse(cached));
        if ("__null" in parsed) return null;
        return parsed;
      }
    } catch {
      // Cache miss / Redis unavailable — fall through to live fetch.
    }
  }

  let profile: GitHubUserProfile | null = null;
  try {
    const { data } = await publicOctokit().users.getByUsername({ username });
    profile = GitHubUserProfileSchema.parse({
      login: data.login,
      id: data.id,
      name: data.name ?? null,
      bio: data.bio ?? null,
      company: data.company ?? null,
      location: data.location ?? null,
      blog: data.blog ?? null,
      email: data.email ?? null,
      twitterUsername: data.twitter_username ?? null,
      avatarUrl: data.avatar_url,
      htmlUrl: data.html_url,
      publicRepos: data.public_repos,
      followers: data.followers,
      following: data.following,
      createdAt: data.created_at,
    });
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status !== 404) {
      // Surface non-404 errors in dev logs but don't crash the page.
      console.warn(`[gh:user:${username}] fetch failed`, e);
    }
    profile = null;
  }

  if (r) {
    try {
      await r.set(
        cacheKey,
        JSON.stringify(profile ?? { __null: true }),
        "EX",
        CACHE_TTL_SECONDS,
      );
    } catch {
      // Cache write failure is non-fatal.
    }
  }

  return profile;
}
