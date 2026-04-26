"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CheckCircle2, FlaskConical, Rocket } from "lucide-react";
import { cn } from "@repo/lib";
import { Badge } from "@repo/ui";
import { Button } from "@repo/ui";
import { Card, CardDescription, CardTitle } from "@repo/ui";
import { Spinner } from "@repo/ui";
import { FormError } from "@/components/shared/FormError";
import { RepoPicker } from "./RepoPicker";
import { TokenMetadataForm } from "./TokenMetadataForm";
import { LeaderboardConfigForm } from "./LeaderboardConfigForm";
import { ReviewAndSign } from "./ReviewAndSign";
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
} from "@repo/shared";

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

/**
 * Two real states the wizard tracks during submit:
 *   - "idle"        : the form is interactive
 *   - "submitting"  : the server action is in flight (single round-trip)
 *
 * The previous implementation faked a 5-step ladder with setTimeout(250).
 * That misled the user into believing each Bags step was happening live,
 * when in reality the action is one round-trip server-side. Removed.
 */
type LaunchStatus = "idle" | "submitting";

interface LaunchSuccess {
  projectId: string;
  tokenMint: string;
  txSig: string | null;
  configKey?: string;
  stub: boolean;
  note?: string;
  ghOwner: string;
  ghRepo: string;
}

export interface WizardShellProps {
  signedIn: boolean;
  /** Server-rendered: true when BAGS_API_KEY is missing (stub mode). */
  isStubMode: boolean;
}

export function WizardShell({ signedIn, isStubMode }: WizardShellProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [repo, setRepo] = useState<GithubRepo | null>(null);
  const [metadata, setMetadata] = useState<TokenMetadataInput | null>(null);
  const [leaderboard, setLeaderboard] =
    useState<LeaderboardConfig>(DEFAULT_LEADERBOARD);

  const [, startTransition] = useTransition();
  const [status, setStatus] = useState<LaunchStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<LaunchSuccess | null>(null);

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
    setSuccess(null);
    setStatus("submitting");

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

    startTransition(async () => {
      try {
        const result = await createAndLaunchAction(body);

        if (!result.ok) {
          setStatus("idle");
          setErrorMessage(formatActionError(result.error, result.message));
          return;
        }

        setSuccess({
          projectId: result.projectId,
          tokenMint: result.tokenMint,
          txSig: result.txSig,
          configKey: result.configKey,
          stub: result.stub,
          note: result.note,
          ghOwner: result.ghOwner,
          ghRepo: result.ghRepo,
        });
        setStatus("idle");
      } catch (e) {
        setStatus("idle");
        setErrorMessage(e instanceof Error ? e.message : "Launch failed.");
      }
    });
  }

  function handleRetry() {
    setErrorMessage(null);
  }

  function handleViewProject() {
    if (!success) return;
    router.push(`/r/${success.ghOwner}/${success.ghRepo}`);
  }

  // ============================================================
  // Render
  // ============================================================

  if (success) {
    return (
      <div className="mx-auto w-full max-w-2xl py-12">
        <LaunchResult result={success} onViewProject={handleViewProject} />
      </div>
    );
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
        ) : status === "submitting" ? (
          <SubmittingState />
        ) : step === 1 ? (
          <RepoPicker
            onSelect={handleRepoSelect}
            selectedId={repo?.id ?? null}
          />
        ) : step === 2 && repo ? (
          <>
            {errorMessage ? (
              <FormError
                message={errorMessage}
                onDismiss={handleRetry}
                className="mb-4"
              />
            ) : null}
            <TokenMetadataForm
              repo={repo}
              initial={metadata}
              onBack={() => goBack(1)}
              onSubmit={handleMetadataSubmit}
            />
          </>
        ) : step === 3 ? (
          <>
            {errorMessage ? (
              <FormError
                message={errorMessage}
                onDismiss={handleRetry}
                className="mb-4"
              />
            ) : null}
            <LeaderboardConfigForm
              initial={leaderboard}
              onBack={() => goBack(2)}
              onSubmit={handleLeaderboardSubmit}
            />
          </>
        ) : step === 4 && repo && metadata ? (
          <>
            {isStubMode ? <TestModeBanner className="mb-5" /> : null}
            {errorMessage ? (
              <FormError
                message={errorMessage}
                onDismiss={handleRetry}
                className="mb-4"
              />
            ) : null}
            <ReviewAndSign
              repo={repo}
              metadata={metadata}
              leaderboard={leaderboard}
              onBack={() => goBack(3)}
              onLaunch={handleLaunch}
              isPending={false}
              isStubMode={isStubMode}
            />
          </>
        ) : (
          <p className="text-body-md text-fg-muted">
            Pick a repo first to continue.
          </p>
        )}
      </section>
    </div>
  );
}

// ============================================================
// Submitting state — single honest spinner, no fake ladder
// ============================================================

function SubmittingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex flex-col items-center justify-center gap-4 py-12 text-center"
    >
      <Spinner size="lg" color="primary" label="Creating project" />
      <div className="space-y-1">
        <p className="text-headline-sm">Creating project…</p>
        <p className="text-body-sm text-fg-secondary">
          Talking to Bags and persisting your launch. This usually takes a few
          seconds — keep this tab open.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Success result
// ============================================================

function LaunchResult({
  result,
  onViewProject,
}: {
  result: LaunchSuccess;
  onViewProject: () => void;
}) {
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";
  const solscanUrl = solscanTxUrl(result.txSig, cluster);
  const mintExplorerUrl = solscanAddressUrl(result.tokenMint, cluster);

  return (
    <Card depth="raised" padding="lg" className="space-y-6">
      <header className="flex flex-col items-center gap-3 text-center">
        {result.stub ? (
          <span className="grid size-12 place-items-center rounded-full bg-warning-soft text-warning">
            <FlaskConical className="size-6" aria-hidden />
          </span>
        ) : (
          <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
        )}
        <CardTitle>
          {result.stub ? "Test launch recorded" : "Token launched"}
        </CardTitle>
        <CardDescription>
          {result.stub
            ? "No real Bags.fm token was created. We persisted a test draft so you can preview the project page UX."
            : "Your project is live on Bags.fm and now appears on the public leaderboard."}
        </CardDescription>
      </header>

      {result.stub ? (
        <Card depth="flat" padding="default" className="bg-warning-soft/40">
          <div className="flex items-start gap-3">
            <Badge variant="warning" dot dotColor="warning">
              Test mode
            </Badge>
            <p className="flex-1 text-body-sm text-fg-secondary">
              {result.note ??
                "BAGS_API_KEY is not set, so the token mint above is a stub. Configure the key to enable real launches."}
            </p>
          </div>
        </Card>
      ) : null}

      <dl className="grid grid-cols-1 gap-3">
        <ResultRow
          k="Token mint"
          v={result.tokenMint}
          href={mintExplorerUrl}
          mono
        />
        {result.txSig ? (
          <ResultRow k="Launch tx" v={result.txSig} href={solscanUrl} mono />
        ) : !result.stub ? (
          <ResultRow
            k="Launch tx"
            v="Pending — Day-3 release will broadcast on-chain."
          />
        ) : null}
        {result.configKey ? (
          <ResultRow k="Bags config key" v={result.configKey} mono />
        ) : null}
      </dl>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        {!result.stub && solscanUrl ? (
          <Button asChild variant="secondary">
            <a href={solscanUrl} target="_blank" rel="noreferrer noopener">
              View on Solscan
              <ArrowUpRight className="size-4" />
            </a>
          </Button>
        ) : null}
        <Button onClick={onViewProject} variant="primary">
          <Rocket className="size-4" />
          Open project page
        </Button>
      </div>
    </Card>
  );
}

function ResultRow({
  k,
  v,
  href,
  mono,
}: {
  k: string;
  v: string;
  href?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <dt className="text-body-sm text-fg-muted">{k}</dt>
      <dd
        className={cn(
          "min-w-0 flex-1 truncate text-right text-body-sm text-fg",
          mono && "text-mono-sm",
        )}
        title={v}
      >
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary hover:underline"
          >
            {v}
          </a>
        ) : (
          v
        )}
      </dd>
    </div>
  );
}

// ============================================================
// Test-mode banner (Review step)
// ============================================================

export function TestModeBanner({ className }: { className?: string }) {
  return (
    <Card
      depth="flat"
      padding="default"
      className={cn(
        "flex items-start gap-3 border-warning/40 bg-warning-soft/40",
        className,
      )}
    >
      <FlaskConical
        className="mt-0.5 size-4 shrink-0 text-warning"
        aria-hidden
      />
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="warning" size="sm">
            Test mode
          </Badge>
          <span className="text-label-sm text-fg">
            No real Bags.fm token will be created
          </span>
        </div>
        <p className="text-body-sm text-fg-secondary">
          BAGS_API_KEY is not configured on this deployment. Submitting will
          persist a project draft with a fake mint so you can walk the rest of
          the flow end-to-end.
        </p>
      </div>
    </Card>
  );
}

// ============================================================
// Step indicator
// ============================================================

function StepIndicator({ current }: { current: Step }) {
  const steps = [1, 2, 3, 4] as const;
  const labels: Record<Step, string> = {
    1: "Repo",
    2: "Token",
    3: "Leaderboard",
    4: "Launch",
  };
  return (
    <ol
      className="flex items-center justify-between gap-3"
      aria-label="Wizard steps"
    >
      {steps.map((s) => {
        const state =
          s < current ? "done" : s === current ? "current" : "future";
        return (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full text-mono-sm font-medium",
                state === "current" && "bg-primary text-fg",
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
      <Button asChild>
        <Link href="/auth/signin?next=/launch">Sign in with GitHub</Link>
      </Button>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

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

function solscanTxUrl(sig: string | null, cluster: string): string | null {
  if (!sig) return null;
  const param = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://solscan.io/tx/${sig}${param}`;
}

function solscanAddressUrl(addr: string, cluster: string): string {
  const param = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://solscan.io/address/${addr}${param}`;
}
