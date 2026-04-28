import { beforeEach, describe, expect, test } from "vitest";
import { useAuthStore } from "./auth-store";
import { resetClientStateForLogout } from "./logout";
import { useLaunchWizardStore } from "./launch-wizard-store";
import type { GithubRepo } from "@repo/shared";

const repo: GithubRepo = {
  id: "42",
  owner: "sym",
  name: "git-bags",
  fullName: "sym/git-bags",
  description: null,
  language: "TypeScript",
  stargazersCount: 12,
  forksCount: 3,
  ownerAvatarUrl: "https://avatars.githubusercontent.com/u/42?v=4",
  alreadyLaunched: false,
  homepage: null,
  topics: [],
  license: null,
  defaultBranch: null,
};

describe("logout client state reset", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    useLaunchWizardStore.getState().reset();
  });

  test("clears auth chrome and user-specific launch drafts", () => {
    useAuthStore.getState().setAuth({
      id: "user_1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      username: "ada",
      imageUrl: null,
      isPlatformAdmin: false,
    });
    useLaunchWizardStore.getState().selectRepo(repo);

    resetClientStateForLogout();

    expect(useAuthStore.getState()).toMatchObject({
      status: "signed-out",
      user: null,
    });
    expect(useLaunchWizardStore.getState()).toMatchObject({
      step: 1,
      repo: null,
      metadata: null,
      status: "idle",
      success: null,
    });
  });
});
