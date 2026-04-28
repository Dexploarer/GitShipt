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

interface LaunchWizardState {
  step: LaunchWizardStep;
  repo: GithubRepo | null;
  metadata: TokenMetadataInput | null;
  leaderboard: LeaderboardConfig;
  status: LaunchStatus;
  errorMessage: string | null;
  success: LaunchSuccess | null;
  goToStep: (step: LaunchWizardStep) => void;
  selectRepo: (repo: GithubRepo) => void;
  setMetadata: (metadata: TokenMetadataInput) => void;
  setLeaderboard: (leaderboard: LeaderboardConfig) => void;
  startSubmit: () => void;
  failSubmit: (message: string) => void;
  succeedSubmit: (success: LaunchSuccess) => void;
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
};

export const useLaunchWizardStore = create<LaunchWizardState>((set) => ({
  ...initialState,
  goToStep: (step) => set({ step, errorMessage: null }),
  selectRepo: (repo) =>
    set((state) => ({
      repo,
      metadata:
        state.repo?.id === repo.id && state.metadata
          ? state.metadata
          : deriveTokenMetadataDefaults(repo),
      step: 2,
      errorMessage: null,
    })),
  setMetadata: (metadata) =>
    set({ metadata, step: 3, errorMessage: null }),
  setLeaderboard: (leaderboard) =>
    set({ leaderboard, step: 4, errorMessage: null }),
  startSubmit: () =>
    set({ status: "submitting", errorMessage: null, success: null }),
  failSubmit: (message) =>
    set({ status: "idle", errorMessage: message }),
  succeedSubmit: (success) =>
    set({ status: "idle", success, errorMessage: null }),
  clearError: () => set({ errorMessage: null }),
  reset: () => set(initialState),
}));

export function resetLaunchWizardStore(): void {
  useLaunchWizardStore.getState().reset();
}

export function deriveTokenMetadataDefaults(
  repo: GithubRepo,
): TokenMetadataInput {
  return {
    name: repo.name.slice(0, 32),
    symbol: deriveSymbolFromRepo(repo.name),
    description: defaultDescription(repo),
    imageUrl: repo.ownerAvatarUrl,
  };
}

export function deriveSymbolFromRepo(repoName: string): string {
  const parts = repoName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const acronym =
    parts.length > 1
      ? parts.map((part) => part[0]).join("")
      : (parts[0] ?? repoName);
  const cleaned = acronym.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const fallback = repoName.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (cleaned || fallback).slice(0, 10) || "GBAGS";
}

function defaultDescription(repo: GithubRepo): string {
  const description = repo.description?.trim();
  if (description) return description.slice(0, 1000);
  return `Token for ${repo.owner}/${repo.name}. Fees redistribute to top contributors daily.`;
}
