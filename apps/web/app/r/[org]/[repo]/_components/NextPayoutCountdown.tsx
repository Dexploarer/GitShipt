"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

/**
 * Live countdown to the next payout window. Server passes the absolute target
 * timestamp (a serialized Date) so the client doesn't need to know cron rules.
 *
 * The interval ticks at 1s. We compute remaining ms each tick from the wall
 * clock — never accumulate — so tab-throttling can't skew the readout.
 */
export function NextPayoutCountdown({ targetIso }: { targetIso: string }) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const target = new Date(targetIso).getTime();
  const remaining = Math.max(0, target - now);
  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const display = `${pad(h)}h ${pad(m)}m ${pad(s)}s`;

  return (
    <section className="flex h-full flex-col rounded-lg border border-border bg-surface p-6">
      <h2 className="inline-flex items-center gap-2 text-label-sm text-fg-muted">
        <Timer className="size-4" />
        Next Payout
      </h2>

      <div
        className="mt-4 text-[1.75rem] font-mono leading-[1.1] text-fg tabular-nums"
        suppressHydrationWarning
        aria-live="polite"
      >
        {display}
      </div>

      <p className="mt-2 text-body-sm text-fg-secondary">
        Daily snapshot + payout at 00:30 UTC.
      </p>
    </section>
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
