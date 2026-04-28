import "server-only";
import { Octokit } from "@octokit/rest";
import { appOctokit, installationOctokit } from "@/lib/github/app";

/**
 * GitHub App installation discovery.
 *
 * The launch wizard uses these helpers to enumerate every account (personal
 * or org) where the GitBags App is installed AND the signed-in user is a
 * member. Per-installation repo lists come from installation auth (no
 * user-to-server token needed).
 *
 * Auth model:
 *  - App-level (`appOctokit`) is used to list ALL installations of the App.
 *  - User OAuth token is used to discover the user's identities (their login
 *    + the orgs they're a member of). We then filter the App's installation
 *    list to only those whose `account.login` matches.
 *  - Installation auth (`installationOctokit`) is used to list repos for each
 *    installation; this avoids requiring a GitHub-App-tied user token, which
 *    `apps.listInstallationsForAuthenticatedUser` would otherwise demand.
 *
 * Permission resolution:
 *  - Personal install (account.login === user login): user owns the account,
 *    every repo is `permissionAdmin: true`.
 *  - Org install: we read the user's role via
 *    `orgs.listMembershipsForAuthenticatedUser`. Role `admin` → all repos
 *    are `permissionAdmin: true`. Otherwise we still surface the repos but
 *    flag them `permissionAdmin: false`; the launch verify step is the
 *    final gate via per-repo OAuth `repos.get`.
 */

export interface InstallationAccount {
  installationId: number;
  accountLogin: string;
  accountAvatarUrl: string;
  accountType: "User" | "Organization";
}

export interface InstallationRepoSummary {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stargazers: number;
  forks: number;
  permissionAdmin: boolean;
  permissionMaintain: boolean;
  installation: InstallationAccount;
}

/**
 * List installations of the App that the user is a member of. Combines
 * App-level enumeration with the user's identity (login + org memberships)
 * to filter.
 */
export async function listInstallationsForUser(
  oauthToken: string,
): Promise<InstallationAccount[]> {
  const userOcto = new Octokit({ auth: oauthToken });

  const [me, orgMemberships] = await Promise.all([
    userOcto.rest.users.getAuthenticated(),
    userOcto.paginate(
      userOcto.rest.orgs.listMembershipsForAuthenticatedUser,
      { state: "active", per_page: 100 },
    ),
  ]);

  const userLogin = me.data.login;
  const orgLogins = new Set(
    orgMemberships
      .map((m) => m.organization?.login)
      .filter((s): s is string => Boolean(s)),
  );

  const app = appOctokit();
  const allInstallations = await app.paginate(
    app.rest.apps.listInstallations,
    { per_page: 100 },
  );

  const matched: InstallationAccount[] = [];
  for (const inst of allInstallations) {
    const account = inst.account;
    if (!account) continue;
    const login = getAccountLogin(account);
    const isMine = login === userLogin || orgLogins.has(login);
    if (!isMine) continue;
    matched.push({
      installationId: inst.id,
      accountLogin: login,
      accountAvatarUrl: getAccountAvatar(account),
      accountType: isOrganizationLike(account) ? "Organization" : "User",
    });
  }
  return matched;
}

/**
 * For a single installation, list every repo the App can act on. Uses
 * installation auth. Permission flags are derived from the user's
 * relationship to the installation account (admin of personal account
 * OR admin role in org), since the App-level repo permissions aren't
 * tied to the user.
 */
export async function listReposForInstallation(
  oauthToken: string,
  installation: InstallationAccount,
  userIsAdmin: boolean,
): Promise<InstallationRepoSummary[]> {
  // oauthToken is currently unused at this layer but accepted so callers
  // don't have to thread two distinct auth tokens. Reserved for a future
  // per-repo permission probe via `repos.getCollaboratorPermissionLevel`
  // when the App-level permissions diverge from the user's effective
  // permissions (rare, but possible with org repo-role overrides).
  void oauthToken;

  const octo = await installationOctokit(installation.installationId);
  const repos: InstallationRepoSummary[] = [];
  const iterator = octo.paginate.iterator(
    octo.rest.apps.listReposAccessibleToInstallation,
    { per_page: 100 },
  );
  for await (const page of iterator) {
    const repositories = (page.data as unknown as { repositories?: unknown[] })
      .repositories ?? (page.data as unknown[]);
    if (!Array.isArray(repositories)) continue;
    for (const raw of repositories) {
      const repo = raw as RepoPayload;
      repos.push({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description ?? null,
        language: repo.language ?? null,
        stargazers: repo.stargazers_count ?? 0,
        forks: repo.forks_count ?? 0,
        permissionAdmin: userIsAdmin,
        permissionMaintain: userIsAdmin,
        installation,
      });
    }
  }
  return repos;
}

/**
 * Every installation matching the user, with their accessible repos
 * populated. Caller caches.
 */
export async function listInstallationsWithReposForUser(
  oauthToken: string,
): Promise<
  Array<{
    installation: InstallationAccount;
    repos: InstallationRepoSummary[];
  }>
> {
  const userOcto = new Octokit({ auth: oauthToken });

  const [me, orgMemberships] = await Promise.all([
    userOcto.rest.users.getAuthenticated(),
    userOcto.paginate(
      userOcto.rest.orgs.listMembershipsForAuthenticatedUser,
      { state: "active", per_page: 100 },
    ),
  ]);

  const userLogin = me.data.login;
  const orgRoleByLogin = new Map<string, "admin" | "member">();
  for (const m of orgMemberships) {
    const login = m.organization?.login;
    if (!login) continue;
    orgRoleByLogin.set(login, m.role === "admin" ? "admin" : "member");
  }

  const app = appOctokit();
  const allInstallations = await app.paginate(
    app.rest.apps.listInstallations,
    { per_page: 100 },
  );

  const out: Array<{
    installation: InstallationAccount;
    repos: InstallationRepoSummary[];
  }> = [];

  for (const inst of allInstallations) {
    const account = inst.account;
    if (!account) continue;
    const login = getAccountLogin(account);
    const accountType = isOrganizationLike(account) ? "Organization" : "User";
    const userIsPersonal = login === userLogin;
    const userOrgRole = orgRoleByLogin.get(login);
    if (!userIsPersonal && !userOrgRole) continue;
    const userIsAdmin = userIsPersonal || userOrgRole === "admin";

    const installation: InstallationAccount = {
      installationId: inst.id,
      accountLogin: login,
      accountAvatarUrl: getAccountAvatar(account),
      accountType,
    };
    const repos = await listReposForInstallation(
      oauthToken,
      installation,
      userIsAdmin,
    );
    out.push({ installation, repos });
  }
  return out;
}

// ============================================================
// Helpers — Octokit's account union is awkward to narrow without
// exhaustive switching. Normalize both shapes (SimpleUser | Enterprise).
// ============================================================

interface RepoPayload {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
}

interface AccountLike {
  login?: string;
  name?: string | null;
  slug?: string;
  avatar_url?: string;
  type?: string;
}

function getAccountLogin(account: AccountLike): string {
  return account.login ?? account.slug ?? account.name ?? "unknown";
}

function getAccountAvatar(account: AccountLike): string {
  return account.avatar_url ?? "https://github.githubassets.com/favicon.ico";
}

function isOrganizationLike(account: AccountLike): boolean {
  return account.type === "Organization";
}
