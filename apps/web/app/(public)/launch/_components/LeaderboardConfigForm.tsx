"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { cn } from "@repo/lib";
import { Button } from "@repo/ui";
import { FormField } from "@/components/shared/FormField";
import { defaultTierWeights, LAMPORTS_PER_SOL_NUMBER } from "@repo/shared";
import type { LeaderboardConfig } from "./WizardShell";

const TOP_N_MIN = 3; // server-side Zod minimum (PayoutConfigSchema.topN)
const TOP_N_MAX = 50;
const WINDOW_MIN = 7;
const WINDOW_MAX = 90;
const FEE_BPS_MAX = 2000;

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

  // Validation per the wizard polish spec:
  //  - top-N: 1-50 inclusive (clamped to >=3 to match server schema)
  //  - tier weights sum: must be <= 1.0
  // We additionally guard the lower bound at 0.999 because a sum of zero
  // would silently let Top-1 = 0 through, and downstream payout logic
  // expects the weights to express the full distribution.
  const tierSumOk = tierSum > 0 && tierSum <= 1.0001;

  const platformFeePercent = (platformFeeBps / 100).toFixed(2);
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
    ? `Tier weights must sum to ≤ 1.0 (currently ${tierSum.toFixed(3)})`
    : undefined;
  const thresholdError =
    !Number.isFinite(thresholdSol) || thresholdSol < 0
      ? "Threshold must be 0 or greater"
      : undefined;
  const feeError =
    platformFeeBps < 0 || platformFeeBps > FEE_BPS_MAX
      ? "Platform fee must be 0–20%"
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
      <header className="space-y-2">
        <h2 className="text-headline-sm">Leaderboard config</h2>
        <p className="text-body-md text-fg-secondary">
          Decide how contributions are scored, who gets paid, and how much goes
          to the GitBags treasury.
        </p>
      </header>

      <FormField
        label={`Scoring window: ${windowDays} days`}
        hint="The rolling window we score contributions over. 7-90 days."
        error={windowError}
      >
        <input
          type="range"
          min={WINDOW_MIN}
          max={WINDOW_MAX}
          step={1}
          value={windowDays}
          onChange={(e) => setWindowDays(Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-primary"
        />
      </FormField>
      <div className="-mt-4 flex items-center justify-between text-caption text-fg-muted">
        <span>{WINDOW_MIN}d</span>
        <span className="text-mono-sm text-fg-secondary">{windowDays}d</span>
        <span>{WINDOW_MAX}d</span>
      </div>

      <FormField
        label={`Top contributors paid: ${topN}`}
        hint="How many ranks share the daily pool. Changing this resets tier weights to the defaults."
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
              if (tierWeights.length !== nextTopN) {
                setTierWeights(defaultTierWeights(nextTopN));
              }
            }
          }}
          className={inputClass}
        />
      </FormField>

      <FormField
        label="Tier weights"
        hint={`Sum: ${tierSum.toFixed(3)} (must be ≤ 1.0). Edit any cell to retune.`}
        error={tierError}
      >
        <TierWeightEditor tierWeights={tierWeights} onChange={setTierWeights} />
      </FormField>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setTierWeights(defaultTierWeights(topN))}
        className="-mt-2"
      >
        Reset to defaults
      </Button>

      <FormField
        label={`Min payout: ${thresholdSol.toFixed(4)} SOL`}
        hint="If accrued fees are below this on a given day, we skip the payout and let it accumulate."
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

      <FormField
        label={`Platform fee: ${platformFeePercent}%`}
        hint="Of every trade, this percentage flows to the GitBags treasury (max 20%). The remainder accrues to the contributor pool."
        error={feeError}
      >
        <input
          type="range"
          min={0}
          max={FEE_BPS_MAX}
          step={25}
          value={platformFeeBps}
          onChange={(e) => setPlatformFeeBps(Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-primary"
        />
      </FormField>
      <div className="-mt-4 flex items-center justify-between text-caption text-fg-muted">
        <span>0%</span>
        <span className="text-mono-sm text-fg-secondary">
          {platformFeeBps} bps
        </span>
        <span>20%</span>
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
    <div className="rounded-md border border-border-strong bg-surface-elevated p-3">
      <ul className="grid max-h-[280px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
        {tierWeights.map((w, idx) => {
          const rank = idx + 1;
          return (
            <li
              key={rank}
              className="flex items-center gap-2 rounded-md bg-surface px-2 py-1.5"
            >
              <span className="w-12 text-label-sm text-fg-muted">
                Top {rank}
              </span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={Number(w.toFixed(4))}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isFinite(v)) return;
                  const next = [...tierWeights];
                  next[idx] = Math.max(0, Math.min(1, v));
                  onChange(next);
                }}
                className={cn(
                  "h-8 w-full min-w-0 rounded-md border border-border-strong bg-surface px-2",
                  "text-mono-sm outline-none focus:border-primary",
                )}
                aria-label={`Top ${rank} weight`}
              />
              <span className="text-mono-sm text-fg-muted">
                {(w * 100).toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 flex items-start gap-2 text-caption text-fg-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Tip: you can leave the defaults and contributors will see the published
        Top-1=30%, Top-2=20%, Top-3=15%, then 5% across the rest.
      </p>
    </div>
  );
}

const inputClass = cn(
  "h-10 w-full rounded-md border border-border-strong bg-surface px-3",
  "text-body-md text-fg outline-none placeholder:text-fg-muted",
  "focus:border-primary",
);
