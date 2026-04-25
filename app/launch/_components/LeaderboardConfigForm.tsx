"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  defaultTierWeights,
  LAMPORTS_PER_SOL_NUMBER,
} from "@/shared";
import type { LeaderboardConfig } from "./WizardShell";

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

  // When topN changes, regenerate the default tier weights.
  useEffect(() => {
    setTierWeights((current) => {
      if (current.length === topN) return current;
      return defaultTierWeights(topN);
    });
  }, [topN]);

  const tierSum = tierWeights.reduce((a, b) => a + b, 0);
  const tierSumOk = tierSum >= 0.999 && tierSum <= 1.001;

  const platformFeePercent = (platformFeeBps / 100).toFixed(2);
  const claimThresholdLamports = Math.max(
    0,
    Math.round(thresholdSol * LAMPORTS_PER_SOL_NUMBER),
  );

  const isValid =
    windowDays >= 7 &&
    windowDays <= 90 &&
    topN >= 3 &&
    topN <= 50 &&
    tierWeights.length === topN &&
    tierSumOk &&
    claimThresholdLamports >= 0 &&
    platformFeeBps >= 0 &&
    platformFeeBps <= 2000;

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
          Decide how contributions are scored, who gets paid, and how much
          goes to the GitBags treasury.
        </p>
      </header>

      <Field
        id="windowDays"
        label={`Scoring window: ${windowDays} days`}
        help="The rolling window we score contributions over. 7-90 days."
      >
        <input
          id="windowDays"
          type="range"
          min={7}
          max={90}
          step={1}
          value={windowDays}
          onChange={(e) => setWindowDays(Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-primary"
        />
        <div className="mt-1 flex items-center justify-between text-caption text-fg-muted">
          <span>7d</span>
          <span className="text-mono-sm text-fg-secondary">
            {windowDays}d
          </span>
          <span>90d</span>
        </div>
      </Field>

      <Field
        id="topN"
        label={`Top contributors paid: ${topN}`}
        help="How many ranks share the daily pool. Changing this resets tier weights to the defaults."
      >
        <input
          id="topN"
          type="number"
          min={3}
          max={50}
          step={1}
          value={topN}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) {
              setTopN(Math.max(3, Math.min(50, Math.round(v))));
            }
          }}
          className={inputClass}
        />
      </Field>

      <Field
        id="tierWeights"
        label="Tier weights"
        help={`Sum: ${tierSum.toFixed(3)} (must be 1.0 ±0.001). Edit any cell to retune.`}
      >
        <TierWeightEditor
          tierWeights={tierWeights}
          onChange={setTierWeights}
        />
        {!tierSumOk ? (
          <p className="mt-2 rounded-md border border-danger bg-danger-soft px-3 py-2 text-body-sm text-danger">
            Tier weights must sum to 1.0 (currently {tierSum.toFixed(3)}).
            Use the &ldquo;Reset to defaults&rdquo; button below if you got
            stuck.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setTierWeights(defaultTierWeights(topN))}
          className="mt-2 inline-flex h-8 items-center rounded-md border border-border-strong bg-surface-elevated px-3 text-label-sm text-fg-secondary hover:bg-surface-overlay"
        >
          Reset to defaults
        </button>
      </Field>

      <Field
        id="threshold"
        label={`Min payout: ${thresholdSol.toFixed(4)} SOL`}
        help="If accrued fees are below this on a given day, we skip the payout and let it accumulate."
      >
        <input
          id="threshold"
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
      </Field>

      <Field
        id="platformFee"
        label={`Platform fee: ${platformFeePercent}%`}
        help="Of every trade, this percentage flows to the GitBags treasury (max 20%). The remainder accrues to the contributor pool."
      >
        <input
          id="platformFee"
          type="range"
          min={0}
          max={2000}
          step={25}
          value={platformFeeBps}
          onChange={(e) => setPlatformFeeBps(Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-primary"
        />
        <div className="mt-1 flex items-center justify-between text-caption text-fg-muted">
          <span>0%</span>
          <span className="text-mono-sm text-fg-secondary">
            {platformFeeBps} bps
          </span>
          <span>20%</span>
        </div>
      </Field>

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border-strong bg-surface-elevated px-4 text-label-md text-fg transition-colors hover:bg-surface-overlay"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <button
          type="submit"
          disabled={!isValid}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-label-md text-fg transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          Continue
          <ArrowRight className="size-4" />
        </button>
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

function Field({
  id,
  label,
  help,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-label-sm text-fg-secondary"
      >
        {label}
      </label>
      {children}
      {help ? <p className="mt-1 text-caption text-fg-muted">{help}</p> : null}
    </div>
  );
}

const inputClass = cn(
  "h-10 w-full rounded-md border border-border-strong bg-surface px-3",
  "text-body-md text-fg outline-none placeholder:text-fg-muted",
  "focus:border-primary",
);
