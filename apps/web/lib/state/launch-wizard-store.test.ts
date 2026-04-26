import { beforeEach, describe, expect, test } from "vitest";
import {
  DEFAULT_LEADERBOARD,
  useLaunchWizardStore,
} from "@/lib/state/launch-wizard-store";
import type { GithubRepo } from "@repo/shared";

const repo: GithubRepo = {
  id: "42",
  owner: "sym",
  name: "git-bags",
  fullName: "sym/git-bags",
  description: "Daily fee payouts for repo contributors",
  language: "TypeScript",
  stargazersCount: 12,
  forksCount: 3,
  ownerAvatarUrl: "https://avatars.githubusercontent.com/u/42?v=4",
  alreadyLaunched: false,
};

describe("launch wizard store", () => {
  beforeEach(() => {
    useLaunchWizardStore.getState().reset();
  });

  test("selecting a repo seeds token metadata and advances the wizard", () => {
    useLaunchWizardStore.getState().selectRepo(repo);

    const state = useLaunchWizardStore.getState();
    expect(state.step).toBe(2);
    expect(state.repo?.fullName).toBe("sym/git-bags");
    expect(state.metadata).toMatchObject({
      name: "git-bags",
      symbol: "GITBAGS",
      description: repo.description,
      imageUrl: repo.ownerAvatarUrl,
    });
  });

  test("reset clears user-specific launch state", () => {
    useLaunchWizardStore.getState().selectRepo(repo);
    useLaunchWizardStore.getState().startSubmit();
    useLaunchWizardStore.getState().failSubmit("Nope");

    useLaunchWizardStore.getState().reset();

    expect(useLaunchWizardStore.getState()).toMatchObject({
      step: 1,
      repo: null,
      metadata: null,
      leaderboard: DEFAULT_LEADERBOARD,
      status: "idle",
      errorMessage: null,
      success: null,
    });
  });
});
