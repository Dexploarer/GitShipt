"use client";

import Image from "next/image";
import { AlertCircle, ArrowLeft, Loader2, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { LAMPORTS_PER_SOL_NUMBER, type GithubRepo, type TokenMetadataInput } from "@/shared";
import type { LeaderboardConfig } from "./WizardShell";
import type { LaunchPhase } from "./LaunchProgress";

export interface ReviewAndSignProps {
  repo: GithubRepo;
  metadata: TokenMetadataInput;
  leaderboard: LeaderboardConfig;
  onBack: () => void;
  onLaunch: () => void;
  isPending: boolean;
  phase: LaunchPhase;
  errorMessage: string | null;
  stubNotice: string | null;
}

export function ReviewAndSign({
  repo,
  metadata,
  leaderboard,
  onBack,
  onLaunch,
  isPending,
  phase,
  errorMessage,
  stubNotice,
}: ReviewAndSignProps) {
  const cluster =
    process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";
  const isDevnet = cluster !== "mainnet-beta";

  const platformFeePct = (leaderboard.platformFeeBps / 100).toFixed(2);
  const claimThresholdSol = (
    leaderboard.claimThresholdLamports / LAMPORTS_PER_SOL_NUMBER
  ).toFixed(4);
  const tierSum = leaderboard.tierWeights.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-headline-sm">Review & launch</h2>
        <p className="text-body-md text-fg-secondary">
          Confirm everything below. The platform hot wallet pays the launch tx
          and becomes the single fee claimer for the contributor pool.
        </p>
        {isDevnet ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-warning-soft px-3 py-1 text-label-sm text-warning">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-warning" />
            Cluster: {cluster}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-label-sm text-success">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-success" />
            Cluster: mainnet-beta
          </span>
        )}
      </header>

      <section className="rounded-lg border border-border bg-surface-elevated p-5">
        <h3 className="text-label-sm uppercase tracking-wide text-fg-muted">
          Repository
        </h3>
        <div className="mt-3 flex items-center gap-3">
          <Image
            src={repo.ownerAvatarUrl}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="size-10 rounded-full bg-surface"
          />
          <div className="min-w-0">
            <div className="truncate text-body-md text-fg">{repo.fullName}</div>
            {repo.description ? (
              <p className="truncate text-body-sm text-fg-secondary">
                {repo.description}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface-elevated p-5">
        <h3 className="text-label-sm uppercase tracking-wide text-fg-muted">
          Token
        </h3>
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          <Row k="Name" v={metadata.name} />
          <Row k="Symbol" v={metadata.symbol} mono />
          <Row k="Image URL" v={metadata.imageUrl} truncate full />
          {metadata.description ? (
            <Row
              k="Description"
              v={metadata.description}
              truncate
              full
            />
          ) : null}
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-surface-elevated p-5">
        <h3 className="text-label-sm uppercase tracking-wide text-fg-muted">
          Leaderboard
        </h3>
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          <Row k="Window" v={`${leaderboard.windowDays} days`} mono />
          <Row k="Top N paid" v={String(leaderboard.topN)} mono />
          <Row
            k="Tier weights sum"
            v={tierSum.toFixed(3)}
            mono
          />
          <Row
            k="Min payout"
            v={`${claimThresholdSol} SOL`}
            mono
          />
          <Row k="Platform fee" v={`${platformFeePct}%`} mono />
          <Row
            k="Contributor pool"
            v={`${(100 - leaderboard.platformFeeBps / 100).toFixed(2)}%`}
            mono
          />
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-surface-elevated p-5">
        <h3 className="text-label-sm uppercase tracking-wide text-fg-muted">
          Estimated launch cost
        </h3>
        <p className="mt-2 text-mono-md text-fg">~0.05 SOL</p>
        <p className="mt-1 text-caption text-fg-muted">
          Approximate Bags launch transaction cost on {cluster}. Paid by the
          GitBags platform wallet.
        </p>
      </section>

      {errorMessage ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-md border border-danger bg-danger-soft p-3 text-body-sm text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {stubNotice ? (
        <div className="flex items-start gap-3 rounded-md border border-warning bg-warning-soft p-3 text-body-sm text-warning">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{stubNotice}</span>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isPending}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border-strong bg-surface-elevated px-4 text-label-md text-fg transition-colors hover:bg-surface-overlay disabled:opacity-60"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <button
          type="button"
          onClick={onLaunch}
          disabled={isPending}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-label-md text-fg transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {isPending && phase !== "done" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Rocket className="size-4" />
          )}
          {phase === "done" ? "Launched" : "Launch"}
        </button>
      </div>
    </div>
  );
}

function Row({
  k,
  v,
  mono,
  truncate,
  full,
}: {
  k: string;
  v: string;
  mono?: boolean;
  truncate?: boolean;
  full?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border py-1.5 last:border-b-0 sm:border-b-0 sm:py-0",
        full && "sm:col-span-2",
      )}
    >
      <dt className="text-body-sm text-fg-muted">{k}</dt>
      <dd
        className={cn(
          "text-body-md text-fg",
          mono && "text-mono-md",
          truncate && "min-w-0 truncate",
        )}
        title={truncate ? v : undefined}
      >
        {v}
      </dd>
    </div>
  );
}
