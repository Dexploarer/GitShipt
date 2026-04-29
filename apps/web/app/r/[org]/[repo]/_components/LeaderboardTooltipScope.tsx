"use client";

import { TooltipProvider } from "@repo/ui";

/**
 * Single client island that mounts one Radix `TooltipProvider` for the
 * entire leaderboard row list. ScoreBreakdownCell instances use plain
 * `Tooltip` / `TooltipTrigger` / `TooltipContent` and inherit the provider
 * from this wrapper.
 *
 * Why hoisted: per-row TooltipProvider is wasteful (each adds its own
 * timer/state) AND prevents the shared "skip-delay-on-subsequent-open"
 * behaviour that Radix uses to make rapid hover-scanning feel snappy.
 *
 * `delayDuration={200}` matches the default in packages/ui/src/tooltip.tsx.
 */
export function LeaderboardTooltipScope({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TooltipProvider delayDuration={200}>{children}</TooltipProvider>;
}
