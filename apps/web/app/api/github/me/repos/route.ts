import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { dbHttp } from "@/db";
import { accounts, projects } from "@/db/schema";
import { check } from "@/lib/rate-limit";
import { hasCredentials, serverEnv } from "@/lib/env";
import { redis } from "@/lib/redis";
import { listInstallationsWithReposForUser } from "@/lib/github/installations";
import {
  GithubReposResponseSchema,
  type GithubRepo,
  type GithubInstallationSummary,
} from "@repo/shared";

export const dynamic = "force-dynamic";

const CACHE_TTL_SECONDS = 30;

/**
 * List the authed user's launchable repos for the wizard, sourced from
 * GitHub App installations rather than OAuth `GET /user/repos`.
 *
 * Why installations are the source of truth:
 *  - We can only index commits, run cron payouts, and react to webhooks for
 *    repos where the App is installed. OAuth-listed repos that lack an
 *    installation cannot launch.
 *  - Installation-scoped lists already filter to repos the user has access
 *    to via that installation, and respect the App's permission grants.
 *
 * Reads the user's OAuth access token from `accounts.access_token` and uses
 * it as the auth identity for `apps.listInstallationsForAuthenticatedUser`
 * + `apps.listInstallationReposForAuthenticatedUser`. The App itself does
 * not authenticate this endpoint — we want to see the user's installations,
 * not all installations of the App.
 *
 * Marks repos that already exist in `projects` as `alreadyLaunched: true`.
 *
 * Cached 30s in Redis under `gitbags:gh:me:installations:{userId}`.
 */
export async function GET(req: Request): Promise<Response> {
  if (!hasCredentials.github()) {
    return NextResponse.json(
      { error: "auth_unavailable", message: "GitHub OAuth not configured." },
      { status: 503 },
    );
  }
  if (!hasCredentials.githubApp()) {
    return NextResponse.json(
      {
        error: "github_app_unavailable",
        message:
          "GitBags GitHub App is not configured on this environment. Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_WEBHOOK_SECRET, GITHUB_APP_SLUG.",
      },
      { status: 503 },
    );
  }
  if (!hasCredentials.db()) {
    return NextResponse.json(
      { error: "db_unavailable", message: "DB not configured." },
      { status: 503 },
    );
  }

  const env = serverEnv();
  const appSlug = env.GITHUB_APP_SLUG;
  if (!appSlug) {
    return NextResponse.json(
      {
        error: "github_app_unavailable",
        message:
          "GITHUB_APP_SLUG is required so the wizard can link to the install URL.",
      },
      { status: 503 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign in with GitHub to list repos." },
      { status: 401 },
    );
  }
  const userId = session.user.id;

  const limit = await check("default", `gh-repos:${userId ?? ip}`);
  if (!limit.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // Cache hit?
  const r = redis();
  const cacheKey = `gitbags:gh:me:installations:${userId}`;
  if (r) {
    const cached = await r.get(cacheKey);
    if (cached) {
      try {
        const parsed = GithubReposResponseSchema.parse(JSON.parse(cached));
        return NextResponse.json(parsed, {
          headers: { "x-cache": "HIT" },
        });
      } catch {
        // fall through and re-fetch
      }
    }
  }

  // Look up the GitHub access token from the better-auth `accounts` table.
  const [account] = await dbHttp
    .select({
      accessToken: accounts.accessToken,
      scope: accounts.scope,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);

  if (!account?.accessToken) {
    return NextResponse.json(
      {
        error: "missing_github_token",
        message:
          "No GitHub OAuth token on file. Sign out and sign back in with GitHub.",
      },
      { status: 401 },
    );
  }

  let groups: Awaited<ReturnType<typeof listInstallationsWithReposForUser>>;
  try {
    groups = await listInstallationsWithReposForUser(account.accessToken);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "GitHub list-installations failed.";
    return NextResponse.json(
      { error: "github_error", message },
      { status: 502 },
    );
  }

  // Compute alreadyLaunched flags. Owners list is bounded by the union of
  // installation account logins, so the projects scan is cheap.
  const ownerLogins = Array.from(
    new Set(groups.map((g) => g.installation.accountLogin)),
  );
  const launchedSet = new Set<string>();
  if (ownerLogins.length > 0) {
    const existing = await dbHttp
      .select({
        ghOwner: projects.ghOwner,
        ghRepo: projects.ghRepo,
      })
      .from(projects);
    for (const row of existing) {
      if (ownerLogins.includes(row.ghOwner)) {
        launchedSet.add(`${row.ghOwner}/${row.ghRepo}`);
      }
    }
  }

  const repos: GithubRepo[] = [];
  const installations: GithubInstallationSummary[] = [];

  for (const { installation, repos: instRepos } of groups) {
    installations.push({
      installationId: installation.installationId,
      accountLogin: installation.accountLogin,
      accountAvatarUrl: installation.accountAvatarUrl,
      accountType: installation.accountType,
      repoCount: instRepos.length,
    });
    for (const repo of instRepos) {
      const owner =
        repo.fullName.split("/")[0] ?? installation.accountLogin;
      repos.push({
        id: String(repo.id),
        owner,
        name: repo.name,
        fullName: repo.fullName,
        description: repo.description,
        language: repo.language,
        stargazersCount: repo.stargazers,
        forksCount: repo.forks,
        ownerAvatarUrl: installation.accountAvatarUrl,
        alreadyLaunched: launchedSet.has(repo.fullName),
        installationId: installation.installationId,
        accountLogin: installation.accountLogin,
        accountAvatarUrl: installation.accountAvatarUrl,
        accountType: installation.accountType,
        permissionAdmin: repo.permissionAdmin,
        permissionMaintain: repo.permissionMaintain,
      });
    }
  }

  const responseBody = GithubReposResponseSchema.parse({
    repos,
    installations,
    appSlug,
    visibilityNote:
      installations.length === 0
        ? "Install the GitBags GitHub App on the account or org that owns your repo. Only installed accounts appear here."
        : undefined,
  });

  if (r) {
    await r.set(
      cacheKey,
      JSON.stringify(responseBody),
      "EX",
      CACHE_TTL_SECONDS,
    );
  }

  return NextResponse.json(responseBody, {
    headers: { "x-cache": "MISS" },
  });
}
