"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui";
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
 * Client island. Expects a `TooltipProvider` from a parent (rendered once
 * by `LeaderboardTooltipScope` around the row list); the shared provider
 * lets subsequent tooltips appear without re-paying the open-delay once
 * one is already open, and avoids spinning up a provider per row on long
 * leaderboards.
 */
export function ScoreBreakdownCell({ score, inputs }: ScoreBreakdownCellProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          // Underlined-on-hover affordance so users notice it's interactive.
          className="cursor-help underline decoration-dotted decoration-fg-muted/60 underline-offset-4 outline-none focus-visible:decoration-fg"
          aria-label={`Score ${formatScore(score)} from ${inputs.mergedPRs} merged PRs, ${inputs.commits} commits, ${inputs.reviews} reviews, ${inputs.issues} issues, and ${inputs.netLines} net lines`}
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
  );
}
