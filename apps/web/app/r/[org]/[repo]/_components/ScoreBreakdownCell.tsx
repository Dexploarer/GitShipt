"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui";
import { formatScore } from "@repo/lib";

interface ScoreBreakdownCellProps {
  score: number;
  inputs: {
    mergedPRs: number;
    commits: number;
    reviews: number;
    issues: number;
    netLines: number;
  };
}

/**
 * Score cell with a hover tooltip showing the input breakdown that produced
 * the displayed score. Answers the contributor's natural "why this rank?"
 * question without forcing them into the full How-scoring-works modal.
 *
 * Pure client island so the surrounding ContributorRow can stay a Server
 * Component. TooltipProvider is local to the trigger — Radix supports
 * nesting providers, so this composes cleanly even if a parent ever adds
 * its own provider.
 */
export function ScoreBreakdownCell({ score, inputs }: ScoreBreakdownCellProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            // Underlined-on-hover affordance so users notice it's interactive.
            className="cursor-help underline decoration-dotted decoration-fg-muted/60 underline-offset-4 outline-none focus-visible:decoration-fg"
            tabIndex={0}
          >
            {formatScore(score)}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-mono-sm">
            <span className="text-fg-muted">Merged PRs</span>
            <span className="text-right text-fg">{inputs.mergedPRs}</span>
            <span className="text-fg-muted">Commits</span>
            <span className="text-right text-fg">{inputs.commits}</span>
            <span className="text-fg-muted">Reviews</span>
            <span className="text-right text-fg">{inputs.reviews}</span>
            <span className="text-fg-muted">Issues</span>
            <span className="text-right text-fg">{inputs.issues}</span>
            <span className="text-fg-muted">Net lines</span>
            <span className="text-right text-fg">
              {inputs.netLines >= 0 ? "+" : ""}
              {inputs.netLines}
            </span>
            <span className="col-span-2 -mx-1 my-0.5 border-t border-border" />
            <span className="text-fg">Score</span>
            <span className="text-right text-fg">{formatScore(score)}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
