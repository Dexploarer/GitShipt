"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { RepoPicker } from "./RepoPicker";
import { TokenMetadataForm } from "./TokenMetadataForm";
import { LeaderboardConfigForm } from "./LeaderboardConfigForm";
import { ReviewAndSign } from "./ReviewAndSign";
import { LaunchProgress, type LaunchPhase } from "./LaunchProgress";
import { createAndLaunchAction } from "../actions";
import {
  DEFAULT_PLATFORM_FEE_BPS,
  DEFAULT_SCORING_CONFIG,
  DEFAULT_TOP_N,
  DEFAULT_WINDOW_DAYS,
  DEFAULT_CLAIM_THRESHOLD_LAMPORTS,
  defaultTierWeights,
  type GithubRepo,
  type TokenMetadataInput,
  type CreateProjectBody,
} from "@/shared";

type Step = 1 | 2 | 3 | 4;

export interface LeaderboardConfig {
  windowDays: number;
  topN: number;
  tierWeights: number[];
  claimThresholdLamports: number;
  platformFeeBps: number;
}

const DEFAULT_LEADERBOARD: LeaderboardConfig = {
  windowDays: DEFAULT_WINDOW_DAYS,
  topN: DEFAULT_TOP_N,
  tierWeights: defaultTierWeights(DEFAULT_TOP_N),
  claimThresholdLamports: DEFAULT_CLAIM_THRESHOLD_LAMPORTS,
  platformFeeBps: DEFAULT_PLATFORM_FEE_BPS,
};

export interface WizardShellProps {
  signedIn: boolean;
}

export function WizardShell({ signedIn }: WizardShellProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [repo, setRepo] = useState<GithubRepo | null>(null);
  const [metadata, setMetadata] = useState<TokenMetadataInput | null>(null);
  const [leaderboard, setLeaderboard] =
    useState<LeaderboardConfig>(DEFAULT_LEADERBOARD);

  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<LaunchPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stubNotice, setStubNotice] = useState<string | null>(null);

  function goNext(toStep: Step) {
    setErrorMessage(null);
    setStep(toStep);
  }

  function goBack(toStep: Step) {
    setErrorMessage(null);
    setStep(toStep);
  }

  function handleRepoSelect(selected: GithubRepo) {
    setRepo(selected);
    // Pre-fill metadata defaults from the repo if not already touched.
    if (!metadata) {
      setMetadata({
        name: selected.name.slice(0, 32),
        symbol: deriveSymbolFromRepo(selected.name),
        description: selected.description ?? "",
        imageUrl: selected.ownerAvatarUrl,
      });
    }
    goNext(2);
  }

  function handleMetadataSubmit(data: TokenMetadataInput) {
    setMetadata(data);
    goNext(3);
  }

  function handleLeaderboardSubmit(data: LeaderboardConfig) {
    setLeaderboard(data);
    goNext(4);
  }

  async function handleLaunch() {
    if (!repo || !metadata) {
      setErrorMessage("Missing repo or token metadata. Restart the wizard.");
      return;
    }

    setErrorMessage(null);
    setStubNotice(null);

    const body: CreateProjectBody = {
      ghRepoId: repo.id,
      ghOwner: repo.owner,
      ghRepo: repo.name,
      name: metadata.name,
      symbol: metadata.symbol,
      description:
        metadata.description && metadata.description.length > 0
          ? metadata.description
          : undefined,
      imageUrl: metadata.imageUrl,
      scoringConfig: {
        ...DEFAULT_SCORING_CONFIG,
        windowDays: leaderboard.windowDays,
      },
      payoutConfig: {
        topN: leaderboard.topN,
        tierWeights: leaderboard.tierWeights,
        claimThresholdLamports: leaderboard.claimThresholdLamports,
      },
      platformFeeBps: leaderboard.platformFeeBps,
    };

    setPhase("creating-draft");

    startTransition(async () => {
      try {
        // Visual ramp through the phases — the action is one round-trip
        // server-side, but the UI shows discrete progress so the user
        // perceives every Bags step happening.
        await delay(250);
        setPhase("uploading-metadata");
        await delay(250);
        setPhase("configuring-fee-share");

        const result = await createAndLaunchAction(body);

        if (!result.ok) {
          setPhase("idle");
          setErrorMessage(formatActionError(result.error, result.message));
          return;
        }

        setPhase("submitting-tx");
        await delay(200);
        setPhase("persisting");
        await delay(200);
        setPhase("done");

        if (result.stub) {
          setStubNotice(
            result.note ??
              "Stub mode — token mint is fake. Configure BAGS_API_KEY for real launches.",
          );
        }

        // Brief pause so the success state is perceived, then redirect.
        await delay(800);
        router.push(`/r/${result.ghOwner}/${result.ghRepo}`);
      } catch (e) {
        setPhase("idle");
        setErrorMessage(e instanceof Error ? e.message : "Launch failed.");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl py-12">
      <StepIndicator current={step} />

      <section
        className={cn(
          "mt-6 rounded-xl border border-border bg-surface p-8",
          "shadow-popover",
        )}
      >
        {!signedIn ? (
          <SignedOutPrompt />
        ) : step === 1 ? (
          <RepoPicker
            onSelect={handleRepoSelect}
            selectedId={repo?.id ?? null}
          />
        ) : step === 2 && repo ? (
          <TokenMetadataForm
            repo={repo}
            initial={metadata}
            onBack={() => goBack(1)}
            onSubmit={handleMetadataSubmit}
          />
        ) : step === 3 ? (
          <LeaderboardConfigForm
            initial={leaderboard}
            onBack={() => goBack(2)}
            onSubmit={handleLeaderboardSubmit}
          />
        ) : step === 4 && repo && metadata ? (
          <ReviewAndSign
            repo={repo}
            metadata={metadata}
            leaderboard={leaderboard}
            onBack={() => goBack(3)}
            onLaunch={handleLaunch}
            isPending={isPending || phase !== "idle"}
            phase={phase}
            errorMessage={errorMessage}
            stubNotice={stubNotice}
          />
        ) : (
          <p className="text-body-md text-fg-muted">
            Pick a repo first to continue.
          </p>
        )}
      </section>

      {phase !== "idle" && phase !== "done" ? (
        <LaunchProgress phase={phase} />
      ) : null}
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps = [1, 2, 3, 4] as const;
  const labels: Record<Step, string> = {
    1: "Repo",
    2: "Token",
    3: "Leaderboard",
    4: "Launch",
  };
  return (
    <ol className="flex items-center justify-between gap-3" aria-label="Wizard steps">
      {steps.map((s) => {
        const state =
          s < current ? "done" : s === current ? "current" : "future";
        return (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full text-mono-sm font-medium",
                state === "current" &&
                  "bg-primary text-fg",
                state === "done" &&
                  "bg-success-soft text-success border border-success",
                state === "future" &&
                  "border border-border-strong text-fg-muted",
              )}
              aria-current={state === "current" ? "step" : undefined}
            >
              {s}
            </span>
            <span
              className={cn(
                "text-label-sm",
                state === "current" && "text-fg",
                state === "done" && "text-fg-secondary",
                state === "future" && "text-fg-muted",
              )}
            >
              {labels[s]}
            </span>
            {s < 4 ? (
              <span
                className={cn(
                  "ml-1 hidden h-px flex-1 sm:block",
                  state === "done" ? "bg-success" : "bg-border",
                )}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function SignedOutPrompt() {
  return (
    <div className="space-y-4">
      <h2 className="text-headline-sm">Sign in to continue</h2>
      <p className="text-body-md text-fg-secondary">
        You need to be signed in with GitHub before you can launch a token.
      </p>
      <a
        href="/auth/signin?next=/launch"
        className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-label-md text-fg transition-colors hover:bg-primary-hover"
      >
        Sign in with GitHub
      </a>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deriveSymbolFromRepo(repoName: string): string {
  const cleaned = repoName.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.slice(0, 10) || "GBAGS";
}

function formatActionError(code: string, message: string): string {
  switch (code) {
    case "rate_limited":
      return "Too many launches. Wait an hour and try again.";
    case "unauthorized":
      return "You're signed out. Refresh and sign in again.";
    case "not_admin":
      return "You don't have admin permission on that repo.";
    case "already_exists":
      return message;
    case "no_github_token":
      return "GitHub token expired. Sign out and sign back in.";
    default:
      return message || "Launch failed.";
  }
}
