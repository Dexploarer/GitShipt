import { beforeEach, describe, expect, test } from "vitest";
import {
  DEFAULT_LEADERBOARD,
  deriveSymbolFromRepo,
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
      symbol: "GB",
      description: repo.description,
      imageUrl: repo.ownerAvatarUrl,
    });
  });

  test("selecting a different repo refreshes token metadata defaults", () => {
    useLaunchWizardStore.getState().selectRepo(repo);
    useLaunchWizardStore.getState().setMetadata({
      name: "Custom token",
      symbol: "CUSTOM",
      description: "Edited metadata",
      imageUrl: repo.ownerAvatarUrl,
    });

    useLaunchWizardStore.getState().selectRepo({
      ...repo,
      id: "43",
      name: "open-source-launch-kit",
      fullName: "sym/open-source-launch-kit",
      description: null,
    });

    const state = useLaunchWizardStore.getState();
    expect(state.step).toBe(2);
    expect(state.metadata).toMatchObject({
      name: "open-source-launch-kit",
      symbol: "OSLK",
      description:
        "Token for sym/open-source-launch-kit. Fees redistribute to top contributors daily.",
      imageUrl: repo.ownerAvatarUrl,
    });
  });

  test("derives compact ticker samples from common repo name patterns", () => {
    expect(deriveSymbolFromRepo("git-bags")).toBe("GB");
    expect(deriveSymbolFromRepo("repoLaunchKit")).toBe("RLK");
    expect(deriveSymbolFromRepo("singlewordrepo")).toBe("SINGLEWORD");
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

  test("records a stub-mode launch success without losing project routing data", () => {
    useLaunchWizardStore.getState().selectRepo(repo);
    useLaunchWizardStore.getState().setMetadata({
      name: "git-bags",
      symbol: "GITBAGS",
      description: repo.description ?? "Daily fee payouts for repo contributors",
      imageUrl: repo.ownerAvatarUrl,
    });
    useLaunchWizardStore.getState().setLeaderboard(DEFAULT_LEADERBOARD);
    useLaunchWizardStore.getState().startSubmit();

    useLaunchWizardStore.getState().succeedSubmit({
      projectId: "project_1",
      tokenMint: "StubMint111111111111111111111111111111111",
      status: "simulated_live",
      txSig: null,
      configKey: "stub_config_key",
      stub: true,
      note: "Stub mode — token mint is fake; no on-chain transaction sent.",
      ghOwner: repo.owner,
      ghRepo: repo.name,
    });

    expect(useLaunchWizardStore.getState()).toMatchObject({
      step: 4,
      status: "idle",
      errorMessage: null,
      success: {
        projectId: "project_1",
        status: "simulated_live",
        stub: true,
        txSig: null,
        ghOwner: "sym",
        ghRepo: "git-bags",
      },
    });
  });
});
