"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";

/**
 * 30-day pool sparkline. Recharts area chart with `chart-1` stroke and a soft
 * matching fill. No axes, minimal tooltip — the sparkline is meant to read
 * as a glance-curve, not a quantitative chart.
 *
 * BigInts can't cross the props boundary into Recharts cleanly, so the parent
 * passes pre-converted numeric SOL values per data point.
 */
export type SparklinePoint = {
  date: string;
  /** SOL value (already converted from lamports). */
  sol: number;
};

export function PoolSparkline({ data }: { data: SparklinePoint[] }) {
  return (
    <div className="h-20 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="poolFill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--chart-1)"
                stopOpacity={0.3}
              />
              <stop
                offset="100%"
                stopColor="var(--chart-1)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <Tooltip
            cursor={{
              stroke: "var(--border-strong)",
              strokeWidth: 1,
              strokeDasharray: "3 3",
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0];
              if (!p) return null;
              const point = p.payload as SparklinePoint;
              return (
                <div className="rounded-md border border-border-strong bg-surface-overlay px-3 py-2 shadow-popover">
                  <div className="text-caption text-fg-muted">{point.date}</div>
                  <div className="mt-0.5 text-mono-sm text-fg">
                    {point.sol.toFixed(4)} SOL
                  </div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="sol"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#poolFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Helper to convert the lamports sparkline series from the data layer into the
 * numeric form Recharts can serialize. Used by the server parent.
 */
export function lamportsSeriesToSol(
  series: { date: string; lamports: bigint }[],
): SparklinePoint[] {
  return series.map((p) => ({
    date: p.date,
    sol: Number(p.lamports) / 1_000_000_000,
  }));
}

// Re-export the helper output type so callers don't have to invent another name.
export type { SparklinePoint as PoolSparklinePoint };
