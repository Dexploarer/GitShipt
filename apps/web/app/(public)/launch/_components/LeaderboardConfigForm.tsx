"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@repo/lib";
import { Button } from "@repo/ui";
import { FormField } from "@/components/shared/FormField";
import { defaultTierWeights, LAMPORTS_PER_SOL_NUMBER } from "@repo/shared";
import type { LeaderboardConfig } from "@/lib/state/launch-wizard-store";

const TOP_N_MIN = 3; // server-side Zod minimum (PayoutConfigSchema.topN)
const TOP_N_MAX = 50;
const WINDOW_MIN = 7;
const WINDOW_MAX = 90;
const PLATFORM_FEE_BPS_MIN = 200;
const PLATFORM_FEE_BPS_PROTOCOL_MAX = 10_000;

export interface LeaderboardConfigFormProps {
  initial: LeaderboardConfig;
  onBack: () => void;
  onSubmit: (data: LeaderboardConfig) => void;
}

export function LeaderboardConfigForm({
  initial,
  onBack,
  onSubmit,
}: LeaderboardConfigFormProps) {
  const [windowDays, setWindowDays] = useState(initial.windowDays);
  const [topN, setTopN] = useState(initial.topN);
  const [tierWeights, setTierWeights] = useState<number[]>(initial.tierWeights);
  const [thresholdSol, setThresholdSol] = useState(
    initial.claimThresholdLamports / LAMPORTS_PER_SOL_NUMBER,
  );
  const [platformFeeBps, setPlatformFeeBps] = useState(initial.platformFeeBps);

  const tierSum = useMemo(
    () => tierWeights.reduce((a, b) => a + b, 0),
    [tierWeights],
  );

  const tierSumOk = tierSum > 0 && tierSum <= 1.0001;

  const platformFeePercent = (platformFeeBps / 100).toFixed(2);
  const contributorPoolBps = Math.max(0, 10_000 - platformFeeBps);
  const contributorPoolPercent = (contributorPoolBps / 100).toFixed(2);
  const claimThresholdLamports = Math.max(
    0,
    Math.round(thresholdSol * LAMPORTS_PER_SOL_NUMBER),
  );

  const windowError =
    windowDays < WINDOW_MIN || windowDays > WINDOW_MAX
      ? `Choose ${WINDOW_MIN}-${WINDOW_MAX} days`
      : undefined;
  const topNError =
    topN < TOP_N_MIN || topN > TOP_N_MAX
      ? `Choose ${TOP_N_MIN}-${TOP_N_MAX} contributors`
      : undefined;
  const tierError = !tierSumOk
    ? `Payout split must be 100% or less (currently ${(tierSum * 100).toFixed(1)}%)`
    : undefined;
  const thresholdError =
    !Number.isFinite(thresholdSol) || thresholdSol < 0
      ? "Threshold must be 0 or greater"
      : undefined;
  const feeError =
    platformFeeBps < PLATFORM_FEE_BPS_MIN
      ? "Platform fee must be at least 2%"
      : platformFeeBps > PLATFORM_FEE_BPS_PROTOCOL_MAX
        ? "Platform fee cannot exceed 100% of trading fees"
      : undefined;

  const isValid =
    !windowError &&
    !topNError &&
    !tierError &&
    !thresholdError &&
    !feeError &&
    tierWeights.length === topN;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSubmit({
      windowDays,
      topN,
      tierWeights,
      claimThresholdLamports,
      platformFeeBps,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <header>
        <h2 className="text-headline-sm">Leaderboard</h2>
      </header>

      <div className="space-y-8">
        <section className="grid gap-4 border-t border-border/70 pt-5 md:grid-cols-[10rem_minmax(0,1fr)]">
          <div className="text-label-md text-fg-secondary">Scoring</div>
          <div className="space-y-2">
            <FormField
              label={`Scoring window: ${windowDays} days`}
              hint="7-90 days."
              error={windowError}
            >
              <input
                type="range"
                min={WINDOW_MIN}
                max={WINDOW_MAX}
                step={1}
                value={windowDays}
                onChange={(e) => setWindowDays(Number(e.target.value))}
                className="gb-range-control w-full"
              />
            </FormField>
            <div className="mt-2 flex items-center justify-between text-caption text-fg-muted">
              <span>{WINDOW_MIN}d</span>
              <span className="text-mono-sm text-fg-secondary">
                {windowDays}d
              </span>
              <span>{WINDOW_MAX}d</span>
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-t border-border/70 pt-5 md:grid-cols-[10rem_minmax(0,1fr)]">
          <div className="text-label-md text-fg-secondary">Payouts</div>
          <div className="min-w-0 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label={`Top contributors paid: ${topN}`}
                hint="Changing this resets tier weights to the defaults."
                error={topNError}
              >
                <input
                  type="number"
                  min={TOP_N_MIN}
                  max={TOP_N_MAX}
                  step={1}
                  value={topN}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) {
                      const nextTopN = Math.max(
                        TOP_N_MIN,
                        Math.min(TOP_N_MAX, Math.round(v)),
                      );
                      setTopN(nextTopN);
                      setTierWeights(defaultTierWeights(nextTopN));
                    }
                  }}
                  className={inputClass}
                />
              </FormField>

              <FormField
                label={`Min payout: ${thresholdSol.toFixed(4)} SOL`}
                hint="Skip if daily fees are lower."
                error={thresholdError}
              >
                <input
                  type="number"
                  min={0}
                  step="0.001"
                  value={thresholdSol}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 0) {
                      setThresholdSol(v);
                    }
                  }}
                  className={cn(inputClass, "text-mono-md")}
                />
              </FormField>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-label-md text-fg">Rank split</div>
                <div className="text-mono-sm text-fg-secondary">
                  {(tierSum * 100).toFixed(1)}%
                </div>
              </div>
              <PayoutSplitPreview tierWeights={tierWeights} />
              {tierError ? (
                <p className="text-caption text-danger">{tierError}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setTierWeights(defaultTierWeights(topN))}
                >
                  Reset split
                </Button>
                <details className="group rounded-md border border-border/70 bg-surface/50">
                  <summary className="gb-control gb-control-secondary flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-label-md text-fg">
                    Edit rank split
                    <span className="text-mono-sm text-fg-muted">
                      {topN} ranks
                    </span>
                  </summary>
                  <div className="border-t border-border/70 p-3">
                    <TierWeightEditor
                      tierWeights={tierWeights}
                      onChange={setTierWeights}
                    />
                  </div>
                </details>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-t border-border/70 pt-5 md:grid-cols-[10rem_minmax(0,1fr)]">
          <div className="text-label-md text-fg-secondary">Fees</div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <FormField
              label={`Platform fee: ${platformFeePercent}%`}
              hint="Minimum 2%."
              error={feeError}
            >
              <input
                type="number"
                min={2}
                step={0.25}
                value={platformFeeBps / 100}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) {
                    setPlatformFeeBps(Math.round(v * 100));
                  }
                }}
                className={cn(inputClass, "text-mono-md")}
              />
            </FormField>

            <div className="space-y-2 rounded-md border border-border/70 bg-surface/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-body-sm text-fg-muted">
                  Contributor pool
                </span>
                <span className="text-mono-sm text-fg">
                  {contributorPoolPercent}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-body-sm text-fg-muted">GitBags fee</span>
                <span className="text-mono-sm text-fg">
                  {platformFeePercent}%
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button type="submit" disabled={!isValid}>
          Continue
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </form>
  );
}

function TierWeightEditor({
  tierWeights,
  onChange,
}: {
  tierWeights: number[];
  onChange: (next: number[]) => void;
}) {
  return (
    <ul className="grid max-h-[280px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
      {tierWeights.map((w, idx) => {
        const rank = idx + 1;
        return (
          <li
            key={rank}
            className="flex items-center gap-2 rounded-md bg-surface px-2 py-1.5"
          >
            <span className="w-10 text-label-sm text-fg-muted">#{rank}</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={Number((w * 100).toFixed(2))}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isFinite(v)) return;
                const next = [...tierWeights];
                next[idx] = Math.max(0, Math.min(100, v)) / 100;
                onChange(next);
              }}
              className={cn(
                "h-8 w-full min-w-0 rounded-md border border-border-strong bg-surface px-2",
                "text-mono-sm outline-none focus:border-primary",
              )}
              aria-label={`Rank ${rank} payout percentage`}
            />
            <span className="text-mono-sm text-fg-muted">%</span>
          </li>
        );
      })}
    </ul>
  );
}

function PayoutSplitPreview({ tierWeights }: { tierWeights: number[] }) {
  const topWeights = tierWeights.slice(0, 3);
  const remainingWeight = tierWeights.slice(3).reduce((a, b) => a + b, 0);
  const blocks = topWeights.map((weight, idx) => ({
    label: `#${idx + 1}`,
    value: weight,
  }));
  if (tierWeights.length > 3) {
    blocks.push({ label: `#4-${tierWeights.length}`, value: remainingWeight });
  }

  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {blocks.map((block) => (
        <div
          key={block.label}
          className="rounded-md border border-border/70 bg-surface/50 p-3"
        >
          <div className="text-label-sm text-fg-muted">{block.label}</div>
          <div className="mt-1 text-mono-md text-fg">
            {(block.value * 100).toFixed(1)}%
          </div>
        </div>
      ))}
    </div>
  );
}

const inputClass = cn(
  "h-10 w-full rounded-md border border-border-strong bg-surface px-3",
  "text-body-md text-fg outline-none placeholder:text-fg-muted",
  "focus:border-primary",
);
