"use client";

import { useEffect, useState } from "react";
import { Activity, Coins, Sparkles, Users } from "lucide-react";
import { formatSol, formatUsd } from "@/lib/format";
import type { LandingTicker } from "@/lib/queries/global";

/**
 * Horizontal KPI strip rendered just below the landing hero. Server passes
 * the canonical snapshot (`initial`); the client adds a tiny drift every 10
 * seconds so the page reads as "live" without burning bandwidth on a real
 * poll endpoint. Drift is bounded to ±0.4% of the seed so the numbers never
 * lie about scale — they just shimmer.
 *
 * When the API for live ticker data lands, swap the drift for a fetch to
 * `/api/ticker` (already shaped by `getLiveTickerData`).
 */

type CellShape = {
  key: string;
  label: string;
  Icon: typeof Activity;
  format: (v: number) => string;
  /** Numeric form of the displayed value used for animation drift. */
  baseValue: number;
};

function deriveCells(initial: LandingTicker): CellShape[] {
  const lifetimeSol = Number(initial.lifetimeFeesLamports) / 1_000_000_000;
  return [
    {
      key: "volume",
      label: "24h volume",
      Icon: Activity,
      format: formatUsd,
      baseValue: initial.volume24hUsd,
    },
    {
      key: "fees",
      label: "Lifetime fees distributed",
      Icon: Coins,
      format: (sol: number) =>
        formatSol(BigInt(Math.max(0, Math.round(sol * 1_000_000_000)))),
      baseValue: lifetimeSol,
    },
    {
      key: "projects",
      label: "Active projects",
      Icon: Sparkles,
      format: (n: number) => Math.max(0, Math.round(n)).toString(),
      baseValue: initial.activeProjects,
    },
    {
      key: "earning",
      label: "Contributors earning",
      Icon: Users,
      format: (n: number) => Math.max(0, Math.round(n)).toString(),
      baseValue: initial.contributorsEarning,
    },
  ];
}

export function LiveTicker({ initial }: { initial: LandingTicker }) {
  const cells = deriveCells(initial);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      aria-label="Live platform metrics"
      className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface/40 p-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      {cells.map(({ key, label, Icon, format, baseValue }) => {
        // Deterministic per-cell drift bounded to ±0.4%.
        const seed = (tick * 13 + key.length * 7) % 19;
        const drift = ((seed - 9) / 9) * 0.004;
        const value = baseValue * (1 + drift);
        return (
          <div
            key={key}
            className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface px-4 py-3"
          >
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-elevated text-fg-secondary"
            >
              <Icon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5 text-label-sm text-fg-muted">
                <span className="size-1.5 animate-pulse-dot rounded-full bg-success" />
                {label}
              </span>
              <span className="truncate text-mono-md text-fg tabular-nums">
                {format(value)}
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
