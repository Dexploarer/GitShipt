import { Activity, Coins, Sparkles, Users } from "lucide-react";
import { cn } from "@repo/lib";
import { formatSol, formatUsd } from "@repo/lib";
import { hasRealLandingVolume, type LandingTicker } from "@/lib/queries/global";

/**
 * Floating live-stat cell (no Card wrapper). Same visual vocabulary as
 * TokenStatsRow on the project page — soft border + bg/40 + caption label
 * + mono value.
 *
 * The displayed value comes straight from `initial: LandingTicker`, which
 * the page hydrates from a cron-published Redis snapshot with a graceful
 * DB-derived fallback. Volume only renders when it is explicitly sourced
 * from real Bags market data.
 *
 * This component is now a pure server-renderable cell: no `useState`, no
 * `useEffect`, no `"use client"`. Liveness comes from the page re-rendering
 * with fresh cache reads, not from local animation.
 */

const CELLS = [
  { key: "volume", label: "24h Volume", Icon: Activity, accent: "text-fg" },
  {
    key: "fees",
    label: "Lifetime Fees",
    Icon: Coins,
    accent: "text-primary-readable",
  },
  {
    key: "projects",
    label: "Active Projects",
    Icon: Sparkles,
    accent: "text-fg",
  },
  { key: "earning", label: "Earners", Icon: Users, accent: "text-fg" },
] as const;

export type BentoTickerCellKey = (typeof CELLS)[number]["key"];

export function getLandingTickerCellKeys(
  ticker: LandingTicker,
): BentoTickerCellKey[] {
  return hasRealLandingVolume(ticker)
    ? ["fees", "volume", "projects", "earning"]
    : ["fees", "projects", "earning"];
}

function format(key: BentoTickerCellKey, t: LandingTicker): string {
  switch (key) {
    case "volume":
      return hasRealLandingVolume(t) ? formatUsd(t.volume24hUsd) : "--";
    case "fees":
      return formatSol(t.lifetimeFeesLamports, 2);
    case "projects":
      return Math.max(0, Math.round(t.activeProjects)).toString();
    case "earning":
      return Math.max(0, Math.round(t.contributorsEarning)).toString();
  }
}

export function BentoTickerCell({
  initial,
  cellKey,
  className,
}: {
  initial: LandingTicker;
  cellKey: BentoTickerCellKey;
  className?: string;
}) {
  const cell = CELLS.find((c) => c.key === cellKey)!;
  if (cellKey === "volume" && !hasRealLandingVolume(initial)) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border border-border/60 bg-surface/40 px-4 py-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-caption text-fg-muted">
          <span className="size-1.5 animate-pulse-dot rounded-full bg-success" />
          {cell.label}
        </span>
        <cell.Icon className="size-3.5 text-fg-muted" aria-hidden />
      </div>
      <div
        className={cn("text-mono-lg tabular-nums", cell.accent)}
        aria-live="polite"
      >
        {format(cellKey, initial)}
      </div>
    </div>
  );
}
