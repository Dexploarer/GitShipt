import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatRelativeTime, formatSol } from "@repo/lib";
import { cn } from "@repo/lib";
import type { RecentPayoutRow } from "@/lib/queries/project-page";

const SOLSCAN_CLUSTER = "devnet";

/**
 * Last 5 payouts, newest first. Each row is clickable iff a tx signature is
 * present — otherwise it's a flat record (e.g. failed/pending). We surface
 * the failure state with a danger dot so users see "this didn't ship" before
 * they wonder why their wallet is empty.
 */
export function RecentPayoutsFeed({ payouts }: { payouts: RecentPayoutRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <header className="flex items-center justify-between">
        <h3 className="text-headline-sm text-fg">Recent Payouts</h3>
        <Link
          href="/dashboard/payouts"
          className="text-label-sm text-fg-secondary transition-colors hover:text-fg"
        >
          View all
        </Link>
      </header>

      <ul className="mt-4 divide-y divide-border">
        {payouts.length === 0 ? (
          <li className="py-6 text-center text-body-sm text-fg-secondary">
            No payouts yet. The first run lands at 00:30 UTC.
          </li>
        ) : (
          payouts.map((p) => <PayoutRow key={p.id} row={p} />)
        )}
      </ul>
    </section>
  );
}

function PayoutRow({ row }: { row: RecentPayoutRow }) {
  const dotTone =
    row.status === "completed"
      ? "bg-success animate-pulse-dot"
      : row.status === "failed" || row.status === "cancelled"
        ? "bg-danger"
        : "bg-warning";

  const inner = (
    <>
      <div className="min-w-0">
        <div className="text-body-md text-fg">
          {formatRelativeTime(row.executedAt)}
        </div>
        <div className="text-caption text-fg-muted">
          {row.recipientCount} recipient{row.recipientCount === 1 ? "" : "s"}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn("size-1.5 shrink-0 rounded-full", dotTone)}
          aria-label={`Status: ${row.status}`}
        />
        <span className="text-mono-md text-fg">
          {formatSol(row.totalLamports, 2)}
        </span>
        {row.claimSignature ? (
          <ArrowUpRight className="size-3.5 text-fg-muted" />
        ) : null}
      </div>
    </>
  );

  if (row.claimSignature) {
    return (
      <li>
        <a
          href={`https://solscan.io/tx/${row.claimSignature}?cluster=${SOLSCAN_CLUSTER}`}
          target="_blank"
          rel="noreferrer noopener"
          className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-3 transition-colors hover:bg-surface-elevated"
        >
          {inner}
        </a>
      </li>
    );
  }
  return (
    <li className="-mx-2 flex items-center justify-between gap-3 px-2 py-3">
      {inner}
    </li>
  );
}
