import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { serverEnv, hasCredentials } from "@/lib/env";

/**
 * GitHub App auth (separate from user OAuth). Used by:
 *  - The 15min indexer cron (commits + merged PRs per project)
 *  - Webhook receivers (verifying signatures)
 *  - The launch wizard (verifying repo admin permission)
 *
 * Per-installation tokens are short-lived (1 hour). Octokit's auth strategy
 * caches them, so we reuse the same `appOctokit` across requests.
 */

let _appOctokit: Octokit | null = null;

export function appOctokit(): Octokit {
  if (_appOctokit) return _appOctokit;
  const env = serverEnv();
  if (!hasCredentials.githubApp()) {
    throw new Error(
      "GitHub App credentials are missing. Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_WEBHOOK_SECRET.",
    );
  }
  _appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.GITHUB_APP_ID!,
      privateKey: env.GITHUB_APP_PRIVATE_KEY!,
    },
  });
  return _appOctokit;
}

/** Octokit scoped to a single installation; valid for that installation only. */
export async function installationOctokit(installationId: number | string): Promise<Octokit> {
  const env = serverEnv();
  if (!hasCredentials.githubApp()) {
    throw new Error("GitHub App credentials missing.");
  }
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.GITHUB_APP_ID!,
      privateKey: env.GITHUB_APP_PRIVATE_KEY!,
      installationId: Number(installationId),
    },
  });
}
