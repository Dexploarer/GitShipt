import Link from "next/link";
import { ArrowUpRight, Coins } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { formatRelativeTime, formatSol } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ContributorProfilePayoutRow } from "@/lib/queries/discovery";

const SOLSCAN_CLUSTER = "devnet";

/**
 * Last 30 payouts received. Mirrors the project page's RecentPayoutsFeed
 * pattern, but the project slug is the primary affordance per row (since
 * the user crosses many projects). Tx signature → Solscan link.
 */
export function EarningsHistory({
  rows,
}: {
  rows: ContributorProfilePayoutRow[];
}) {
  return (
    <Card depth="raised" padding="default">
      <CardHeader>
        <CardTitle>Earnings history</CardTitle>
      </CardHeader>
      <CardContent className="mt-4">
        {rows.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <PayoutRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PayoutRow({ row }: { row: ContributorProfilePayoutRow }) {
  const inner = (
    <>
      <div className="min-w-0">
        <div className="truncate text-body-md text-fg">
          {row.projectSlug}
        </div>
        <div className="text-mono-sm text-fg-muted">
          {formatRelativeTime(row.executedAt)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-mono-md text-fg">
          {formatSol(row.amountLamports, 4)}
        </span>
        {row.txSignature ? (
          <ArrowUpRight className="size-3.5 text-fg-muted" />
        ) : null}
      </div>
    </>
  );

  if (row.txSignature) {
    return (
      <li>
        <a
          href={`https://solscan.io/tx/${row.txSignature}?cluster=${SOLSCAN_CLUSTER}`}
          target="_blank"
          rel="noreferrer noopener"
          className={cn(
            "-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-3 transition-colors",
            "hover:bg-surface-elevated",
          )}
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

function Empty() {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <Coins className="size-10 text-fg-muted" aria-hidden />
      <p className="text-body-md text-fg-secondary">
        No payouts yet. Earnings appear here after the daily 00:30 UTC payout
        cycle ships.
      </p>
      <Link
        href="/explore"
        className="mt-1 text-label-md text-primary hover:underline"
      >
        Browse projects
      </Link>
    </div>
  );
}
