import { ArrowUpRight } from "lucide-react";
import { formatSol, formatUsd, lamportsSeriesToSol } from "@/lib/format";
import { PoolSparkline } from "./PoolSparkline";
import type { PoolOverview } from "@/lib/queries/project-page";

/**
 * The page hero — the single primary-purple element on the screen.
 * Display-size SOL value uses `text-primary`, and the sparkline below uses
 * `var(--chart-1)` which is the same purple. We deliberately avoid pairing
 * any other purple element (button, pill) on the same fold to keep the
 * one-primary-per-viewport rule intact.
 */
export function PoolOverviewCard({ pool }: { pool: PoolOverview }) {
  const sparklineData = lamportsSeriesToSol(pool.sparkline);
  const feeSharePct = (pool.feeShareBps / 100).toFixed(0);

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-label-sm text-fg-muted">Daily Fee Pool</div>
          {pool.isStub ? (
            <div className="mt-0.5 text-caption text-fg-muted">
              (stubbed — Bags key not configured)
            </div>
          ) : null}
        </div>
        <span className="inline-flex items-center rounded-full border border-border bg-surface-elevated px-2.5 py-1 text-label-sm text-fg-secondary">
          Fee Share: {feeSharePct}%
        </span>
      </div>

      <div>
        <div className="text-display text-primary">
          {formatSol(pool.dailyFeeLamports, 2)}
        </div>
        <div className="mt-1 text-mono-sm text-fg-muted">
          {formatUsd(pool.dailyFeeUsd)}
        </div>
      </div>

      <PoolSparkline data={sparklineData} />

      <div className="flex items-center justify-between text-caption text-fg-muted">
        <span>Source: Trading Fees</span>
        <span className="text-mono-sm">
          Lifetime {formatSol(pool.lifetimeLamports, 2)}
        </span>
      </div>

      {pool.bagsUrl ? (
        <a
          href={pool.bagsUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center justify-between rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-label-md text-fg transition-colors hover:bg-surface-overlay"
        >
          View on Bags.fm
          <ArrowUpRight className="size-4 text-fg-secondary" />
        </a>
      ) : null}
    </section>
  );
}
