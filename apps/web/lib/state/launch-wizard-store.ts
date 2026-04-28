"use client";

import { create } from "zustand";
import {
  DEFAULT_CLAIM_THRESHOLD_LAMPORTS,
  DEFAULT_PLATFORM_FEE_BPS,
  DEFAULT_TOP_N,
  DEFAULT_WINDOW_DAYS,
  defaultTierWeights,
  type GithubRepo,
  type TokenMetadataInput,
} from "@repo/shared";

export type LaunchWizardStep = 1 | 2 | 3 | 4;
export type LaunchStatus = "idle" | "submitting";

export interface LeaderboardConfig {
  windowDays: number;
  topN: number;
  tierWeights: number[];
  claimThresholdLamports: number;
  platformFeeBps: number;
}

export interface LaunchSuccess {
  projectId: string;
  tokenMint: string;
  status: "launch_configured" | "live" | "simulated_live";
  txSig: string | null;
  configKey?: string;
  stub: boolean;
  note?: string;
  ghOwner: string;
  ghRepo: string;
}

export const DEFAULT_LEADERBOARD: LeaderboardConfig = {
  windowDays: DEFAULT_WINDOW_DAYS,
  topN: DEFAULT_TOP_N,
  tierWeights: defaultTierWeights(DEFAULT_TOP_N),
  claimThresholdLamports: DEFAULT_CLAIM_THRESHOLD_LAMPORTS,
  platformFeeBps: DEFAULT_PLATFORM_FEE_BPS,
};

export interface DraftHydrationInput {
  projectId: string;
  repo: GithubRepo;
  metadata: TokenMetadataInput;
  leaderboard: LeaderboardConfig;
}

interface LaunchWizardState {
  step: LaunchWizardStep;
  repo: GithubRepo | null;
  metadata: TokenMetadataInput | null;
  leaderboard: LeaderboardConfig;
  status: LaunchStatus;
  errorMessage: string | null;
  success: LaunchSuccess | null;
  /** Active draft DB id. Set when the user saves or resumes a draft. */
  draftProjectId: string | null;
  goToStep: (step: LaunchWizardStep) => void;
  selectRepo: (repo: GithubRepo) => void;
  setMetadata: (metadata: TokenMetadataInput) => void;
  setLeaderboard: (leaderboard: LeaderboardConfig) => void;
  startSubmit: () => void;
  failSubmit: (message: string) => void;
  succeedSubmit: (success: LaunchSuccess) => void;
  setDraftProjectId: (id: string | null) => void;
  hydrateFromDraft: (input: DraftHydrationInput) => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  step: 1 as LaunchWizardStep,
  repo: null,
  metadata: null,
  leaderboard: DEFAULT_LEADERBOARD,
  status: "idle" as LaunchStatus,
  errorMessage: null,
  success: null,
  draftProjectId: null,
};

export const useLaunchWizardStore = create<LaunchWizardState>((set) => ({
  ...initialState,
  goToStep: (step) => set({ step, errorMessage: null }),
  selectRepo: (repo) =>
    set((state) => ({
      repo,
      metadata:
        state.metadata ??
        ({
          name: repo.name.slice(0, 32),
          symbol: deriveSymbolFromRepo(repo.name),
          description: defaultDescription(repo),
          imageUrl: repo.ownerAvatarUrl,
          website: validUrlOrUndefined(repo.homepage),
        } satisfies TokenMetadataInput),
      step: 2,
      errorMessage: null,
    })),
  setMetadata: (metadata) =>
    set({ metadata, step: 3, errorMessage: null }),
  setLeaderboard: (leaderboard) =>
    set({ leaderboard, step: 4, errorMessage: null }),
  setDraftProjectId: (id) => set({ draftProjectId: id }),
  hydrateFromDraft: ({ projectId, repo, metadata, leaderboard }) =>
    set({
      draftProjectId: projectId,
      repo,
      metadata,
      leaderboard,
      // Land on step 4 (Review) — every previous step has data to edit if the
      // user wants to change anything, but the default is "you can launch now".
      step: 4,
      errorMessage: null,
      status: "idle",
      success: null,
    }),
  startSubmit: () =>
    set({ status: "submitting", errorMessage: null, success: null }),
  failSubmit: (message) =>
    set({ status: "idle", errorMessage: message }),
  succeedSubmit: (success) =>
    set({
      status: "idle",
      success,
      errorMessage: null,
      // The draft has been promoted to live/launch_configured; clear the id so
      // any stray "Save draft" click after success doesn't try to PATCH a
      // non-draft row.
      draftProjectId: null,
    }),
  clearError: () => set({ errorMessage: null }),
  reset: () => set(initialState),
}));

export function resetLaunchWizardStore(): void {
  useLaunchWizardStore.getState().reset();
}

function deriveSymbolFromRepo(repoName: string): string {
  const cleaned = repoName.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.slice(0, 10) || "GBAGS";
}

function defaultDescription(repo: GithubRepo): string {
  const description = repo.description?.trim();
  if (description) return description.slice(0, 1000);
  return `Token for ${repo.owner}/${repo.name}. Fees redistribute to top contributors daily.`;
}

function validUrlOrUndefined(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // GitHub homepage is often "example.com" without a scheme. The Bags
  // schema requires a full URL, so prepend https:// when missing.
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    new URL(candidate);
    return candidate;
  } catch {
    return undefined;
  }
}
