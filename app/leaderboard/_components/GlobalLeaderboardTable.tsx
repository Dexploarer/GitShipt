import Image from "next/image";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatSol } from "@/lib/format";
import { RankMedal } from "@/app/r/[org]/[repo]/_components/RankMedal";
import type {
  GlobalLeaderboardEntry,
  GlobalProjectEntry,
} from "@/lib/queries/global";

type Mode = "contributor" | "project";

/**
 * Cross-project leaderboard rendered inside a single raised card with a
 * sticky column header and an internally scrollable body. Two modes share
 * the same shell so the toggle on the page can swap content without
 * rebuilding the chrome.
 */
export function GlobalLeaderboardTable(
  props:
    | { mode: "contributor"; rows: GlobalLeaderboardEntry[] }
    | { mode: "project"; rows: GlobalProjectEntry[] },
) {
  const { mode } = props;
  const empty = props.rows.length === 0;

  return (
    <Card
      depth="raised"
      padding="none"
      className="flex flex-col overflow-hidden"
    >
      <div className="flex items-center gap-2.5 px-5 py-4 lg:px-6 lg:py-5">
        <Trophy className="size-5 text-fg-secondary" aria-hidden />
        <h2 className="text-headline-md leading-none text-fg">
          {mode === "contributor"
            ? "Top contributors"
            : "Top projects"}
        </h2>
        <span className="hidden items-center gap-1.5 text-body-sm text-fg-muted sm:inline-flex">
          <span className="size-1.5 animate-pulse-dot rounded-full bg-success" />
          Updated each payout cycle
        </span>
      </div>

      {empty ? (
        <div className="border-t border-border px-5 py-12 text-center text-body-md text-fg-secondary">
          No payouts have been confirmed yet — once the first cycle clears,
          contributors will appear here.
        </div>
      ) : mode === "contributor" ? (
        <ContributorList rows={props.rows} />
      ) : (
        <ProjectList rows={props.rows} />
      )}
    </Card>
  );
}

function ContributorList({ rows }: { rows: GlobalLeaderboardEntry[] }) {
  return (
    <>
      <div className="grid grid-cols-[56px_minmax(0,1fr)_140px_88px_minmax(0,200px)] items-center gap-3 border-y border-border bg-surface-elevated/40 px-5 py-2.5 text-label-sm text-fg-muted lg:px-6">
        <div>#</div>
        <div>Contributor</div>
        <div className="text-right">Lifetime SOL</div>
        <div className="text-right">Projects</div>
        <div className="truncate">Top project</div>
      </div>

      <div
        className="max-h-[640px] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--border-strong)_transparent]"
        aria-label="Global contributor rankings, scrollable"
      >
        {rows.map((row) => (
          <div
            key={row.ghUsername}
            className="grid grid-cols-[56px_minmax(0,1fr)_140px_88px_minmax(0,200px)] items-center gap-3 border-b border-border px-5 py-3 last:border-b-0 hover:bg-surface-elevated lg:px-6"
          >
            <div className="flex items-center">
              <RankMedal rank={row.rank} />
            </div>
            <Link
              href={`/u/${row.ghUsername}`}
              className="flex min-w-0 items-center gap-3 transition-colors hover:text-fg"
            >
              <Image
                src={row.avatarUrl}
                alt=""
                width={32}
                height={32}
                className="size-8 shrink-0 rounded-lg bg-surface-elevated"
                unoptimized
              />
              <div className="min-w-0">
                <div className="truncate text-body-md text-fg">
                  {row.ghUsername}
                </div>
                <div className="truncate text-body-sm text-fg-muted">
                  @{row.ghUsername}
                </div>
              </div>
            </Link>
            <div className="text-right text-mono-md text-fg">
              {formatSol(row.totalLifetimeLamports)}
            </div>
            <div className="text-right text-mono-sm text-fg-muted">
              {row.activeProjectsCount}
            </div>
            <div className="min-w-0">
              {row.topProjectSlug ? (
                <Link
                  href={`/r/${row.topProjectSlug}`}
                  className="block truncate text-body-sm text-fg-secondary transition-colors hover:text-fg"
                >
                  {row.topProjectSlug}
                </Link>
              ) : (
                <span className="text-body-sm text-fg-muted">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ProjectList({ rows }: { rows: GlobalProjectEntry[] }) {
  return (
    <>
      <div className="grid grid-cols-[56px_minmax(0,1fr)_140px_120px_120px] items-center gap-3 border-y border-border bg-surface-elevated/40 px-5 py-2.5 text-label-sm text-fg-muted lg:px-6">
        <div>#</div>
        <div>Project</div>
        <div className="text-right">Lifetime fees</div>
        <div className="text-right">Contributors</div>
        <div className="text-right">Daily pool</div>
      </div>

      <div
        className="max-h-[640px] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--border-strong)_transparent]"
        aria-label="Global project rankings, scrollable"
      >
        {rows.map((row) => {
          const avatar =
            row.imageUrl ?? `https://github.com/${row.slug.split("/")[0]}.png`;
          return (
            <Link
              key={row.id}
              href={`/r/${row.slug}`}
              className="grid grid-cols-[56px_minmax(0,1fr)_140px_120px_120px] items-center gap-3 border-b border-border px-5 py-3 last:border-b-0 transition-colors hover:bg-surface-elevated lg:px-6"
            >
              <div className="flex items-center">
                <RankMedal rank={row.rank} />
              </div>
              <div className="flex min-w-0 items-center gap-3">
                <Image
                  src={avatar}
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 shrink-0 rounded-lg bg-surface-elevated"
                  unoptimized
                />
                <div className="min-w-0">
                  <div className="truncate text-body-md text-fg">
                    {row.name}
                  </div>
                  <div className="truncate text-body-sm text-fg-muted">
                    {row.slug}
                  </div>
                </div>
              </div>
              <div className="text-right text-mono-md text-fg">
                {formatSol(row.lifetimeFeesLamports)}
              </div>
              <div className="text-right text-mono-sm text-fg-muted">
                {row.contributorsPaid}
              </div>
              <div className="text-right text-mono-sm text-fg-muted">
                {formatSol(row.dailyFeeLamports)}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
