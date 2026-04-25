import { Trophy } from "lucide-react";
import { ContributorRow } from "./ContributorRow";
import { HowScoringWorksModal } from "./HowScoringWorksModal";
import { formatSol } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/queries/project-page";
import type { ScoringConfig, PayoutConfig } from "@/db/schema";

/**
 * The leaderboard. Server component; the only client island is the modal
 * trigger inside the header. Renders an empty state when no contributors
 * have been ranked yet (e.g. before the first snapshot job runs).
 */
export function LeaderboardTable({
  rows,
  dailyFeeLamports,
  dailyFeeUsd,
  scoringConfig,
  payoutConfig,
}: {
  rows: LeaderboardRow[];
  dailyFeeLamports: bigint;
  dailyFeeUsd: number | null;
  scoringConfig: ScoringConfig;
  payoutConfig: PayoutConfig;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <header className="flex flex-col gap-1.5 border-b border-border px-6 pt-6 pb-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-headline-md text-fg">
            <Trophy className="size-5 text-fg-secondary" aria-hidden />
            Leaderboard
          </h2>
          <HowScoringWorksModal
            scoringConfig={scoringConfig}
            payoutConfig={payoutConfig}
          />
        </div>
        <p className="text-body-sm text-fg-secondary">
          Top {payoutConfig.topN} contributors ranked by 30-day GitHub activity.
        </p>
        <div className="mt-1 flex items-center gap-2 text-body-sm text-fg-secondary">
          <span className="size-1.5 animate-pulse-dot rounded-full bg-success" />
          Updates daily at 00:00 UTC
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="px-6 py-12 text-center text-body-md text-fg-secondary">
          No contributors ranked yet — the first snapshot will land at
          midnight UTC.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[56px_minmax(0,1fr)_96px_88px_140px] items-center gap-4 border-b border-border px-4 py-3 text-label-sm text-fg-muted">
            <div>Rank</div>
            <div>Contributor</div>
            <div className="text-right">Score</div>
            <div className="text-right">% of Pool</div>
            <div className="text-right">Earnings</div>
          </div>
          <div>
            {rows.map((row) => (
              <ContributorRow
                key={row.contributorId}
                row={row}
                dailyFeeLamports={dailyFeeLamports}
                dailyFeeUsd={dailyFeeUsd}
              />
            ))}
          </div>
        </>
      )}

      <footer className="flex items-center justify-between border-t border-border bg-surface-elevated px-6 py-4">
        <span className="text-label-sm text-fg-muted">
          Total Pool Distributed Daily
        </span>
        <span className="text-mono-md text-fg">
          {formatSol(dailyFeeLamports)}
        </span>
      </footer>
    </section>
  );
}
