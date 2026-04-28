import { Activity, Coins, Sparkles, Users } from "lucide-react";
import { cn } from "@repo/lib";
import { formatSol, formatUsd } from "@repo/lib";
import type { LandingTicker } from "@/lib/queries/global";

/**
 * Floating live-stat cell (no Card wrapper). Same visual vocabulary as
 * TokenStatsRow on the project page — soft border + bg/40 + caption label
 * + mono value.
 *
 * The displayed value comes straight from `initial: LandingTicker`, which
 * the page hydrates from a cron-published Redis snapshot (`gitbags:ticker:
 * landing`, refreshed every minute by `workflows/publishKpis.ts`) with a
 * graceful DB-derived fallback. The previous ±0.4% client-side drift on a
 * 10s setInterval was removed — that was simulated liveness, not data.
 *
 * This component is now a pure server-renderable cell: no `useState`, no
 * `useEffect`, no `"use client"`. Liveness comes from the page re-rendering
 * with fresh cache reads, not from local animation.
 */

const CELLS = [
  { key: "volume", label: "24h Volume", Icon: Activity, accent: "text-fg" },
  { key: "fees", label: "Lifetime Fees", Icon: Coins, accent: "text-primary" },
  {
    key: "projects",
    label: "Active Projects",
    Icon: Sparkles,
    accent: "text-fg",
  },
  { key: "earning", label: "Earners", Icon: Users, accent: "text-fg" },
] as const;

type CellKey = (typeof CELLS)[number]["key"];

function format(key: CellKey, t: LandingTicker): string {
  switch (key) {
    case "volume":
      return formatUsd(t.volume24hUsd);
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
  cellKey: CellKey;
  className?: string;
}) {
  const cell = CELLS.find((c) => c.key === cellKey)!;

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
