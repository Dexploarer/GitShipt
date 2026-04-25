"use client";

import { useEffect, useRef, useState } from "react";
import { Info, X } from "lucide-react";
import type { ScoringConfig, PayoutConfig } from "@/db/schema";

/**
 * Custom modal for the "How Scoring Works" pill. We hand-roll the dialog
 * surface because shadcn's Dialog primitive isn't wired yet on Day 2.
 *
 * Click backdrop or ESC to close. Focus trap is approximate (ESC + restore
 * trigger focus) — enough for a non-form informational modal.
 */
export function HowScoringWorksModal({
  scoringConfig,
  payoutConfig,
}: {
  scoringConfig: ScoringConfig;
  payoutConfig: PayoutConfig;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // Soft focus: move focus into the panel; restore on close via the effect cleanup.
    const trigger = triggerRef.current;
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  const w = scoringConfig.weights;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-label-sm text-primary transition-colors hover:bg-primary-soft/80"
      >
        <Info className="size-3.5" />
        How Scoring Works
      </button>

      {open ? (
        <div
          role="presentation"
          className="fixed inset-0 z-50 grid place-items-center bg-bg/60 px-4 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="scoring-modal-title"
            tabIndex={-1}
            className="w-full max-w-lg rounded-xl border border-border-strong bg-surface-overlay p-8 shadow-modal outline-none"
          >
            <div className="flex items-start justify-between gap-4">
              <h2
                id="scoring-modal-title"
                className="text-headline-sm text-fg"
              >
                How Scoring Works
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-fg-secondary transition-colors hover:bg-surface-elevated hover:text-fg"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="mt-3 text-body-md text-fg-secondary">
              Every contributor gets a score from on-chain-verifiable GitHub
              activity. The top {payoutConfig.topN} contributors share the
              daily fee pool by tier weight.
            </p>

            <div className="mt-6 rounded-lg border border-border bg-surface p-4">
              <div className="text-label-sm text-fg-muted">Formula</div>
              <pre className="mt-2 overflow-x-auto text-mono-sm leading-6 text-fg">
{`score =
    mergedPRs * ${w.mergedPRs.toFixed(1)}
  + commits   * ${w.commits.toFixed(1)}
  + reviews   * ${w.reviews.toFixed(1)}
  + issues    * ${w.issues.toFixed(1)}
  + log10(1 + netLines) * ${w.netLines.toFixed(1)}`}
              </pre>
            </div>

            <ul className="mt-6 space-y-3 text-body-md text-fg-secondary">
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-fg-muted" />
                <span>
                  <span className="text-fg">Window:</span> last{" "}
                  <span className="text-mono-md text-fg">
                    {scoringConfig.windowDays}
                  </span>{" "}
                  days, refreshed at 00:00 UTC every day.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-fg-muted" />
                <span>
                  <span className="text-fg">Time decay:</span>{" "}
                  {scoringConfig.decay} — recent commits weigh more than old
                  ones.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-fg-muted" />
                <span>
                  <span className="text-fg">Bot exclusion:</span> accounts
                  matching the platform blocklist (dependabot, renovate,
                  github-actions, etc.) are dropped before ranking.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-fg-muted" />
                <span>
                  <span className="text-fg">Tier weights:</span>{" "}
                  <span className="text-mono-sm text-fg-muted">
                    [{payoutConfig.tierWeights.map((w) => w.toFixed(2)).join(", ")}]
                  </span>{" "}
                  — sums to 1.0.
                </span>
              </li>
            </ul>

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 items-center rounded-md border border-border-strong bg-surface-elevated px-4 text-label-md text-fg transition-colors hover:bg-surface-overlay"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
