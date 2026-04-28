import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  mockUsersGetAuthenticated,
  mockOrgsListMemberships,
  mockUserPaginate,
  mockAppListInstallations,
  mockAppPaginate,
  mockInstallationListRepos,
  mockInstallationPaginateIterator,
} = vi.hoisted(() => ({
  mockUsersGetAuthenticated: vi.fn(),
  mockOrgsListMemberships: vi.fn(),
  mockUserPaginate: vi.fn(),
  mockAppListInstallations: vi.fn(),
  mockAppPaginate: vi.fn(),
  mockInstallationListRepos: vi.fn(),
  mockInstallationPaginateIterator: vi.fn(),
}));

vi.mock("@octokit/rest", () => ({
  Octokit: class {
    constructor(_opts: unknown) {}
    rest = {
      users: { getAuthenticated: mockUsersGetAuthenticated },
      orgs: { listMembershipsForAuthenticatedUser: mockOrgsListMemberships },
    };
    paginate = mockUserPaginate;
  },
}));

vi.mock("@/lib/github/app", () => ({
  appOctokit: () => ({
    rest: { apps: { listInstallations: mockAppListInstallations } },
    paginate: mockAppPaginate,
  }),
  installationOctokit: async (_id: number) => ({
    rest: {
      apps: { listReposAccessibleToInstallation: mockInstallationListRepos },
    },
    paginate: { iterator: mockInstallationPaginateIterator },
  }),
}));

import {
  listInstallationsForUser,
  listInstallationsWithReposForUser,
  listReposForInstallation,
  type InstallationAccount,
} from "./installations";

afterEach(() => {
  mockUsersGetAuthenticated.mockReset();
  mockOrgsListMemberships.mockReset();
  mockUserPaginate.mockReset();
  mockAppListInstallations.mockReset();
  mockAppPaginate.mockReset();
  mockInstallationListRepos.mockReset();
  mockInstallationPaginateIterator.mockReset();
});

function fakeIterator<T>(pages: T[]): AsyncIterable<{ data: T }> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        next() {
          if (i >= pages.length) {
            return Promise.resolve({ value: undefined, done: true as const });
          }
          const value = { data: pages[i++] as T };
          return Promise.resolve({ value, done: false as const });
        },
      };
    },
  };
}

function setUserIdentity(
  userLogin: string,
  orgs: Array<{ login: string; role: "admin" | "member" }>,
): void {
  mockUsersGetAuthenticated.mockResolvedValue({ data: { login: userLogin } });
  // userOcto.paginate is called twice — first for memberships in the
  // *ForUser variants. The mock returns memberships flat.
  mockUserPaginate.mockImplementation(async () =>
    orgs.map((o) => ({
      organization: { login: o.login },
      role: o.role,
    })),
  );
}

describe("listInstallationsForUser", () => {
  it("returns empty when no App installations match the user", async () => {
    setUserIdentity("alice", []);
    mockAppPaginate.mockResolvedValue([
      {
        id: 999,
        account: { login: "stranger", avatar_url: "x", type: "User" },
      },
    ]);
    const result = await listInstallationsForUser("oauth-token");
    expect(result).toEqual([]);
  });

  it("matches personal installation by user login", async () => {
    setUserIdentity("alice", []);
    mockAppPaginate.mockResolvedValue([
      {
        id: 101,
        account: {
          login: "alice",
          avatar_url: "https://avatars.githubusercontent.com/u/1",
          type: "User",
        },
      },
    ]);
    const result = await listInstallationsForUser("oauth-token");
    expect(result).toEqual([
      {
        installationId: 101,
        accountLogin: "alice",
        accountAvatarUrl: "https://avatars.githubusercontent.com/u/1",
        accountType: "User",
      },
    ]);
  });

  it("matches org installation when user is a member (any role)", async () => {
    setUserIdentity("alice", [
      { login: "acme-corp", role: "member" },
      { login: "side-project", role: "admin" },
    ]);
    mockAppPaginate.mockResolvedValue([
      {
        id: 202,
        account: {
          login: "acme-corp",
          avatar_url: "https://avatars.githubusercontent.com/o/2",
          type: "Organization",
        },
      },
      {
        id: 303,
        account: {
          login: "side-project",
          avatar_url: "https://avatars.githubusercontent.com/o/3",
          type: "Organization",
        },
      },
      {
        id: 404,
        account: {
          login: "stranger-org",
          avatar_url: "x",
          type: "Organization",
        },
      },
    ]);
    const result = await listInstallationsForUser("oauth-token");
    expect(result.map((r) => r.accountLogin)).toEqual([
      "acme-corp",
      "side-project",
    ]);
    expect(result[0]?.accountType).toBe("Organization");
  });
});

describe("listReposForInstallation", () => {
  const installation: InstallationAccount = {
    installationId: 101,
    accountLogin: "alice",
    accountAvatarUrl: "https://avatars.githubusercontent.com/u/1",
    accountType: "User",
  };

  it("returns repos with admin flags reflecting the userIsAdmin arg", async () => {
    mockInstallationPaginateIterator.mockReturnValue(
      fakeIterator([
        {
          repositories: [
            {
              id: 1,
              name: "alpha",
              full_name: "alice/alpha",
              description: "first",
              language: "TypeScript",
              stargazers_count: 5,
              forks_count: 1,
            },
            {
              id: 2,
              name: "beta",
              full_name: "alice/beta",
              description: null,
              language: null,
              stargazers_count: 0,
              forks_count: 0,
            },
          ],
        },
      ]),
    );
    const result = await listReposForInstallation(
      "oauth-token",
      installation,
      true,
    );
    expect(result.map((r) => r.fullName)).toEqual([
      "alice/alpha",
      "alice/beta",
    ]);
    expect(result.every((r) => r.permissionAdmin)).toBe(true);
    expect(result.every((r) => r.permissionMaintain)).toBe(true);
    expect(result[0]?.installation).toEqual(installation);
  });

  it("flips permissionAdmin to false when user is non-admin org member", async () => {
    mockInstallationPaginateIterator.mockReturnValue(
      fakeIterator([
        {
          repositories: [
            {
              id: 10,
              name: "ops",
              full_name: "acme-corp/ops",
              description: null,
              language: null,
              stargazers_count: 0,
              forks_count: 0,
            },
          ],
        },
      ]),
    );
    const orgInstall: InstallationAccount = {
      installationId: 202,
      accountLogin: "acme-corp",
      accountAvatarUrl: "x",
      accountType: "Organization",
    };
    const result = await listReposForInstallation(
      "oauth-token",
      orgInstall,
      false,
    );
    expect(result[0]?.permissionAdmin).toBe(false);
    expect(result[0]?.permissionMaintain).toBe(false);
  });
});

describe("listInstallationsWithReposForUser", () => {
  it("returns matched installations with their accessible repos", async () => {
    setUserIdentity("alice", [{ login: "acme-corp", role: "admin" }]);
    mockAppPaginate.mockResolvedValue([
      {
        id: 101,
        account: {
          login: "alice",
          avatar_url: "https://avatars.githubusercontent.com/u/1",
          type: "User",
        },
      },
      {
        id: 202,
        account: {
          login: "acme-corp",
          avatar_url: "https://avatars.githubusercontent.com/o/2",
          type: "Organization",
        },
      },
    ]);
    mockInstallationPaginateIterator
      .mockReturnValueOnce(
        fakeIterator([
          {
            repositories: [
              {
                id: 1,
                name: "alpha",
                full_name: "alice/alpha",
                description: null,
                language: null,
                stargazers_count: 0,
                forks_count: 0,
              },
            ],
          },
        ]),
      )
      .mockReturnValueOnce(
        fakeIterator([
          {
            repositories: [
              {
                id: 10,
                name: "ops",
                full_name: "acme-corp/ops",
                description: null,
                language: null,
                stargazers_count: 0,
                forks_count: 0,
              },
            ],
          },
        ]),
      );

    const result = await listInstallationsWithReposForUser("oauth-token");
    expect(result).toHaveLength(2);
    expect(result[0]?.installation.accountLogin).toBe("alice");
    expect(result[0]?.repos.map((r) => r.fullName)).toEqual(["alice/alpha"]);
    expect(result[0]?.repos[0]?.permissionAdmin).toBe(true);
    expect(result[1]?.installation.accountLogin).toBe("acme-corp");
    expect(result[1]?.repos[0]?.permissionAdmin).toBe(true);
  });

  it("returns an empty list when no App installations match the user", async () => {
    setUserIdentity("alice", []);
    mockAppPaginate.mockResolvedValue([
      {
        id: 999,
        account: { login: "stranger", avatar_url: "x", type: "User" },
      },
    ]);
    const result = await listInstallationsWithReposForUser("oauth-token");
    expect(result).toEqual([]);
  });
});
