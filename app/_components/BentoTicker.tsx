"use client";

import { useEffect, useState } from "react";
import { Activity, Coins, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSol, formatUsd } from "@/lib/format";
import type { LandingTicker } from "@/lib/queries/global";

/**
 * Floating live-stat cell (no Card wrapper). Same visual vocabulary as
 * TokenStatsRow on the project page — soft border + bg/40 + caption label
 * + mono value. Each cell self-tracks ±0.4% drift on a 10s tick.
 */

const CELLS = [
  { key: "volume", label: "24h Volume", Icon: Activity, accent: "text-fg" },
  { key: "fees", label: "Lifetime Fees", Icon: Coins, accent: "text-primary" },
  { key: "projects", label: "Active Projects", Icon: Sparkles, accent: "text-fg" },
  { key: "earning", label: "Earners", Icon: Users, accent: "text-fg" },
] as const;

type CellKey = (typeof CELLS)[number]["key"];

function format(key: CellKey, value: number): string {
  switch (key) {
    case "volume":
      return formatUsd(value);
    case "fees":
      return formatSol(BigInt(Math.max(0, Math.round(value * 1_000_000_000))), 2);
    case "projects":
    case "earning":
      return Math.max(0, Math.round(value)).toString();
  }
}

function baseValue(key: CellKey, t: LandingTicker): number {
  switch (key) {
    case "volume":
      return t.volume24hUsd;
    case "fees":
      return Number(t.lifetimeFeesLamports) / 1_000_000_000;
    case "projects":
      return t.activeProjects;
    case "earning":
      return t.contributorsEarning;
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
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const cell = CELLS.find((c) => c.key === cellKey)!;
  const seed = (tick * 13 + cellKey.length * 7) % 19;
  const drift = ((seed - 9) / 9) * 0.004;
  const value = baseValue(cellKey, initial) * (1 + drift);

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
        className={cn("text-mono-md tabular-nums", cell.accent)}
        style={{ fontSize: "20px", letterSpacing: "-0.005em" }}
        aria-live="polite"
      >
        {format(cellKey, value)}
      </div>
    </div>
  );
}
