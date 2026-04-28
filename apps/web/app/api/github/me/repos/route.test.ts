import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// Hoisted mocks — vi.mock factories run before module-level locals are
// initialised, so anything they close over has to be created via vi.hoisted.
// ============================================================

const mocks = vi.hoisted(() => {
  const dbReturns: unknown[][] = [];
  const chainable = (): unknown => {
    const next = dbReturns.shift() ?? [];
    const obj = {
      from: () => obj,
      where: () => obj,
      limit: () => obj,
      then: (
        resolve: (value: unknown[]) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(next).then(resolve, reject),
      catch: (reject: (reason: unknown) => unknown) =>
        Promise.resolve(next).catch(reject),
    };
    return obj;
  };

  return {
    hasCredentials: {
      github: vi.fn(() => true),
      githubApp: vi.fn(() => true),
      db: vi.fn(() => true),
    },
    serverEnv: vi.fn(() => ({ GITHUB_APP_SLUG: "gitbags" })),
    getSession: vi.fn(),
    check: vi.fn(async () => ({ success: true })),
    redisGet: vi.fn(async () => null),
    redisSet: vi.fn(async () => "OK"),
    listInstallationsWithRepos: vi.fn(),
    dbReturns,
    chainable,
  };
});

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("@/lib/env", () => ({
  hasCredentials: mocks.hasCredentials,
  serverEnv: mocks.serverEnv,
}));

vi.mock("@/lib/auth", () => ({
  auth: () => ({ api: { getSession: mocks.getSession } }),
}));

vi.mock("@/lib/rate-limit", () => ({
  check: mocks.check,
}));

vi.mock("@/lib/redis", () => ({
  redis: () => ({ get: mocks.redisGet, set: mocks.redisSet }),
}));

vi.mock("@/db", () => ({
  dbHttp: { select: () => mocks.chainable() as { from: () => unknown } },
}));
vi.mock("@/db/schema", () => ({
  accounts: {},
  projects: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: (..._args: unknown[]) => ({ __eq: true }),
}));

vi.mock("@/lib/github/installations", () => ({
  listInstallationsWithReposForUser: mocks.listInstallationsWithRepos,
}));

// ============================================================
// Route under test
// ============================================================

import { GET } from "./route";

function makeReq(): Request {
  return new Request("http://localhost/api/github/me/repos");
}

beforeEach(() => {
  mocks.hasCredentials.github.mockReturnValue(true);
  mocks.hasCredentials.githubApp.mockReturnValue(true);
  mocks.hasCredentials.db.mockReturnValue(true);
  mocks.serverEnv.mockReturnValue({ GITHUB_APP_SLUG: "gitbags" });
  mocks.getSession.mockResolvedValue({ user: { id: "user_1" } });
  mocks.check.mockResolvedValue({ success: true });
  mocks.redisGet.mockResolvedValue(null);
  mocks.redisSet.mockResolvedValue("OK");
  mocks.dbReturns.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/github/me/repos", () => {
  it("returns 503 when the GitHub App is not configured", async () => {
    mocks.hasCredentials.githubApp.mockReturnValue(false);
    const res = await GET(makeReq());
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("github_app_unavailable");
  });

  it("returns 401 when the user has no OAuth token on file", async () => {
    // First DB call: accounts lookup → return empty so token is missing.
    mocks.dbReturns.push([]);
    mocks.listInstallationsWithRepos.mockResolvedValue([]);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("missing_github_token");
  });

  it("returns the new shape with repos, installations, and appSlug on success", async () => {
    mocks.dbReturns.push([
      { accessToken: "oauth-token", scope: "read:user" },
    ]);
    mocks.dbReturns.push([]);
    mocks.listInstallationsWithRepos.mockResolvedValue([
      {
        installation: {
          installationId: 101,
          accountLogin: "alice",
          accountAvatarUrl: "https://avatars.githubusercontent.com/u/1",
          accountType: "User",
        },
        repos: [
          {
            id: 1,
            name: "alpha",
            fullName: "alice/alpha",
            description: "first",
            language: "TypeScript",
            stargazers: 5,
            forks: 1,
            permissionAdmin: true,
            permissionMaintain: true,
            installation: {
              installationId: 101,
              accountLogin: "alice",
              accountAvatarUrl: "https://avatars.githubusercontent.com/u/1",
              accountType: "User",
            },
          },
        ],
      },
    ]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      repos: Array<Record<string, unknown>>;
      installations: Array<Record<string, unknown>>;
      appSlug: string;
    };

    expect(body.appSlug).toBe("gitbags");
    expect(body.installations).toEqual([
      {
        installationId: 101,
        accountLogin: "alice",
        accountAvatarUrl: "https://avatars.githubusercontent.com/u/1",
        accountType: "User",
        repoCount: 1,
      },
    ]);
    expect(body.repos).toHaveLength(1);
    expect(body.repos[0]).toMatchObject({
      id: "1",
      owner: "alice",
      name: "alpha",
      fullName: "alice/alpha",
      installationId: 101,
      accountLogin: "alice",
      permissionAdmin: true,
      permissionMaintain: true,
      alreadyLaunched: false,
    });
  });

  it("flags repos that already have a project as alreadyLaunched", async () => {
    mocks.dbReturns.push([
      { accessToken: "oauth-token", scope: "read:user" },
    ]);
    // Existing project for alice/alpha — should mark it alreadyLaunched.
    mocks.dbReturns.push([{ ghOwner: "alice", ghRepo: "alpha" }]);
    mocks.listInstallationsWithRepos.mockResolvedValue([
      {
        installation: {
          installationId: 101,
          accountLogin: "alice",
          accountAvatarUrl: "https://avatars.githubusercontent.com/u/1",
          accountType: "User",
        },
        repos: [
          {
            id: 1,
            name: "alpha",
            fullName: "alice/alpha",
            description: null,
            language: null,
            stargazers: 0,
            forks: 0,
            permissionAdmin: true,
            permissionMaintain: true,
            installation: {
              installationId: 101,
              accountLogin: "alice",
              accountAvatarUrl: "https://avatars.githubusercontent.com/u/1",
              accountType: "User",
            },
          },
          {
            id: 2,
            name: "beta",
            fullName: "alice/beta",
            description: null,
            language: null,
            stargazers: 0,
            forks: 0,
            permissionAdmin: true,
            permissionMaintain: true,
            installation: {
              installationId: 101,
              accountLogin: "alice",
              accountAvatarUrl: "https://avatars.githubusercontent.com/u/1",
              accountType: "User",
            },
          },
        ],
      },
    ]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      repos: Array<{ fullName: string; alreadyLaunched: boolean }>;
    };
    const byName = Object.fromEntries(
      body.repos.map((r) => [r.fullName, r.alreadyLaunched]),
    );
    expect(byName["alice/alpha"]).toBe(true);
    expect(byName["alice/beta"]).toBe(false);
  });
});
