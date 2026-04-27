"use client";

import { Info } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui";
import type { ScoringConfig, PayoutConfig } from "@/db/schema";

export function HowScoringWorksModal({
  scoringConfig,
  payoutConfig,
}: {
  scoringConfig: ScoringConfig;
  payoutConfig: PayoutConfig;
}) {
  const w = scoringConfig.weights;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface-elevated px-3 py-1.5 text-label-sm text-fg-secondary transition-colors hover:bg-surface-overlay hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <Info className="size-3.5" aria-hidden />
          How scoring works
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[min(90vh,720px)] max-w-lg overflow-y-auto rounded-xl border-border-strong bg-surface-overlay p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle>How scoring works</DialogTitle>
          <DialogDescription className="text-body-md">
            Every contributor gets a score from GitHub activity. The top{" "}
            <span className="text-mono-md text-fg">{payoutConfig.topN}</span>{" "}
            contributors share the daily fee pool by tier weight.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-surface p-4">
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

        <ul className="space-y-3 text-body-md text-fg-secondary">
          <li className="flex gap-3">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-fg-muted" />
            <span>
              <span className="text-fg">Window:</span> last{" "}
              <span className="text-mono-md text-fg">
                {scoringConfig.windowDays}
              </span>{" "}
              days, refreshed at{" "}
              <span className="text-mono-sm text-fg">00:00 UTC</span>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-fg-muted" />
            <span>
              <span className="text-fg">Time decay:</span>{" "}
              {scoringConfig.decay} - recent commits weigh more than old ones.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-fg-muted" />
            <span>
              <span className="text-fg">Bot exclusion:</span> accounts matching
              the platform blocklist are dropped before ranking.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-fg-muted" />
            <span>
              <span className="text-fg">Tier weights:</span>{" "}
              <span className="text-mono-sm text-fg">
                [{payoutConfig.tierWeights.map((w) => w.toFixed(2)).join(", ")}]
              </span>{" "}
              sums to <span className="text-mono-sm text-fg">1.0</span>.
            </span>
          </li>
        </ul>

        <DialogFooter>
          <DialogClose asChild>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-md border border-border-strong bg-surface-elevated px-4 text-label-md text-fg transition-colors hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Got it
            </button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
