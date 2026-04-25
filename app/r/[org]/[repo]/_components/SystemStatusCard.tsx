import { Settings2 } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SystemStatusItem } from "@/lib/queries/project-page";

const NAME_LABEL: Record<string, string> = {
  runtime: "Runtime",
  indexer: "Leaderboard Cron",
  payouts: "Payout Cron",
};

const FRESH_MS = 2 * 60 * 1000;
const STALE_MS = 10 * 60 * 1000;

function tone(ageMs: number | null): {
  dot: string;
  label: string;
  text: string;
} {
  if (ageMs == null) {
    return { dot: "bg-danger", label: "no data", text: "text-danger" };
  }
  if (ageMs < FRESH_MS) {
    return {
      dot: "bg-success animate-pulse-dot",
      label: "healthy",
      text: "text-success",
    };
  }
  if (ageMs < STALE_MS) {
    return { dot: "bg-warning", label: "lagging", text: "text-warning" };
  }
  return { dot: "bg-danger", label: "stale", text: "text-danger" };
}

/**
 * Worker heartbeat status. Each row's dot reflects the freshness of the
 * underlying job's last beat: green pulsing if <2min, yellow if <10min,
 * red otherwise (or when we have no record at all).
 */
export function SystemStatusCard({ items }: { items: SystemStatusItem[] }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <header className="flex items-center gap-2">
        <Settings2 className="size-4 text-fg-secondary" aria-hidden />
        <h3 className="text-headline-sm text-fg">System Status</h3>
      </header>

      <ul className="mt-4 space-y-3">
        {items.map((item) => {
          const t = tone(item.ageMs);
          const display = NAME_LABEL[item.name] ?? item.name;
          return (
            <li
              key={item.name}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <span className={cn("size-1.5 rounded-full", t.dot)} />
                <span className="text-body-md text-fg">{display}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-label-sm", t.text)}>{t.label}</span>
                <span className="text-mono-sm text-fg-muted">
                  {item.lastBeatAt
                    ? formatRelativeTime(new Date(item.lastBeatAt))
                    : "—"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
