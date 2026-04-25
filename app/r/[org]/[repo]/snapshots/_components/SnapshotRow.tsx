"use client";

import { useState } from "react";
import { ChevronDown, History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatAddress,
  formatPercent,
  formatRelativeTime,
  formatScore,
  formatSol,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { CopyButton } from "../../_components/CopyButton";
import type { SnapshotRow as SnapshotRowData } from "@/lib/queries/discovery";

/**
 * One row in the snapshot ledger. Top-level shows the freeze metadata; the
 * expand toggle reveals the top-10 leaderboard preview that was Merkle-rooted.
 */
export function SnapshotRow({ row }: { row: SnapshotRowData }) {
  const [open, setOpen] = useState(false);

  return (
    <Card depth="raised" padding="default" className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <History className="size-4 shrink-0 text-fg-muted" aria-hidden />
          <div className="min-w-0">
            <div
              className="text-mono-sm text-fg"
              title={row.takenAt.toISOString()}
            >
              {formatRelativeTime(row.takenAt)}
            </div>
            <div className="text-caption text-fg-muted">
              {row.takenAt.toISOString()}
            </div>
          </div>
        </div>

        <StatusBadge status={row.status} />
        {row.forced ? (
          <Badge variant="warning" size="sm">
            Forced
          </Badge>
        ) : null}

        <Stat label="Total fees">
          <span className="text-mono-md text-fg">
            {formatSol(row.totalFeesLamports, 4)}
          </span>
        </Stat>

        <Stat label="Recipients">
          <span className="text-mono-md text-fg">
            {row.recipientCount.toLocaleString("en-US")}
          </span>
        </Stat>

        <Stat label="Formula">
          <span className="text-mono-sm text-fg">{row.formulaVersion}</span>
        </Stat>

        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="truncate text-mono-sm text-fg"
            title={row.merkleRoot}
          >
            {formatAddress(row.merkleRoot, 6, 6)}
          </span>
          <CopyButton value={row.merkleRoot} label="Copy Merkle root" />
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="ml-auto inline-flex h-9 items-center gap-1 rounded-md border border-border-strong bg-surface px-3 text-label-sm text-fg-secondary transition-colors hover:bg-surface-elevated hover:text-fg"
        >
          {open ? "Hide" : "Expand"}
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
          />
        </button>
      </div>

      {open ? (
        <div className="mt-5 border-t border-border pt-4">
          {row.leaderboard.length === 0 ? (
            <p className="text-body-sm text-fg-secondary">
              No leaderboard entries captured in this snapshot.
            </p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-label-sm text-fg-muted">
                  <th className="pb-2 pr-4 font-medium">Rank</th>
                  <th className="pb-2 pr-4 font-medium">Contributor</th>
                  <th className="pb-2 pr-4 text-right font-medium">Score</th>
                  <th className="pb-2 text-right font-medium">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {row.leaderboard.map((e) => (
                  <tr key={`${e.rank}-${e.ghUsername}`}>
                    <td className="py-2 pr-4 text-mono-sm text-fg">
                      #{e.rank}
                    </td>
                    <td className="py-2 pr-4 text-body-sm text-fg">
                      <span className="text-mono-sm text-fg-secondary">@</span>
                      {e.ghUsername}
                    </td>
                    <td className="py-2 pr-4 text-right text-mono-md text-fg">
                      {formatScore(e.score)}
                    </td>
                    <td className="py-2 text-right text-mono-md text-fg">
                      {formatPercent(e.weight * 100, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-[6rem]">
      <div className="text-caption text-fg-muted">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: SnapshotRowData["status"];
}) {
  if (status === "paid") {
    return (
      <Badge variant="success" size="sm" dot>
        Paid
      </Badge>
    );
  }
  if (status === "frozen") {
    return (
      <Badge variant="info" size="sm">
        Frozen
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="danger" size="sm">
        Failed
      </Badge>
    );
  }
  return (
    <Badge variant="warning" size="sm">
      Pending
    </Badge>
  );
}
