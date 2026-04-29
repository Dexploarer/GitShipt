import "server-only";
import { z } from "zod";
import { CACHE_SECONDS, cacheTags, getCachedValue } from "@/lib/cache";
import { fetchGitHubJsonWithEtag } from "@/lib/github/http-cache";
import {
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

const GitHubUserApiSchema = z
  .object({
    login: z.string(),
    id: z.number().int(),
    name: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
    company: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    blog: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    twitter_username: z.string().nullable().optional(),
    avatar_url: z.string().url(),
    html_url: z.string().url(),
    public_repos: z.number().int().min(0).optional(),
    followers: z.number().int().min(0).optional(),
    following: z.number().int().min(0).optional(),
    created_at: z.string(),
  })
  .loose();

async function getGitHubUserUncached(
  username: string,
): Promise<GitHubUserProfile | null> {
  if (!username) return null;

  let profile: GitHubUserProfile | null = null;
  try {
    const data = await fetchGitHubJsonWithEtag(
      `${CACHE_PREFIX}${username.toLowerCase()}`,
      `https://api.github.com/users/${encodeURIComponent(username)}`,
      GitHubUserApiSchema,
      { ttlSeconds: CACHE_TTL_SECONDS },
    );
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
      publicRepos: data.public_repos ?? 0,
      followers: data.followers ?? 0,
      following: data.following ?? 0,
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

  return profile;
}

export async function getGitHubUser(
  username: string,
): Promise<GitHubUserProfile | null> {
  const normalized = username.toLowerCase();
  return getCachedValue(
    () => getGitHubUserUncached(username),
    ["gitshipt:github-user:v1", normalized],
    {
      tags: [cacheTags.public, cacheTags.githubUser(normalized)],
      revalidate: CACHE_SECONDS.profile,
    },
  );
}
