import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProjectPageData } from "@/lib/queries/project-page";
import { ProjectHeader } from "./_components/ProjectHeader";
import { NextPayoutCountdown } from "./_components/NextPayoutCountdown";
import { LeaderboardTable } from "./_components/LeaderboardTable";
import { PoolOverviewCard } from "./_components/PoolOverviewCard";
import { RecentPayoutsFeed } from "./_components/RecentPayoutsFeed";
import { SystemStatusCard } from "./_components/SystemStatusCard";
import { ProjectSidebar } from "@/components/sidebar/ProjectSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

type Params = { org: string; repo: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { org, repo } = await params;
  const data = await getProjectPageData(org, repo);
  if (!data) {
    return { title: `${org}/${repo}` };
  }
  return {
    title: `${data.header.name} · Leaderboard`,
    description:
      data.header.description ??
      `Daily on-chain payouts for contributors to ${data.header.ghOwner}/${data.header.ghRepo}.`,
  };
}

/**
 * Public project page (`/r/[org]/[repo]`).
 *
 * Layout (macOS Tahoe-flavored): the whole page sits inside a 12px gutter
 * so the floating sidebar + content columns appear to lift off a deeper bg.
 * Sidebar is a Liquid-Glass aside (collapsable, full-height, rounded). The
 * right column stacks: main content card stack, then a tucked footer with
 * rounded-tl that visually meets the sidebar.
 */
export default async function ProjectPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { org, repo } = await params;
  const data = await getProjectPageData(org, repo);
  if (!data) {
    notFound();
  }

  const { header, leaderboard, pool, recentPayouts, systemStatus, nextPayoutAt } =
    data;
  const slug = `${header.ghOwner}/${header.ghRepo}`;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen gap-3 bg-bg p-3 text-fg">
        <ProjectSidebar
          slug={slug}
          active="leaderboard"
          canAdmin={false}
          token={{ header, pool }}
          wallet={{}}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <main className="min-w-0 flex-1">
            <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_380px]">
              {/* Left column */}
              <div className="flex min-w-0 flex-col gap-gutter">
                <div className="grid grid-cols-1 gap-gutter md:grid-cols-[minmax(0,1fr)_280px]">
                  <ProjectHeader header={header} />
                  <NextPayoutCountdown targetIso={nextPayoutAt.toISOString()} />
                </div>

                <LeaderboardTable
                  rows={leaderboard}
                  dailyFeeLamports={pool.dailyFeeLamports}
                  dailyFeeUsd={pool.dailyFeeUsd}
                  scoringConfig={header.scoringConfig}
                  payoutConfig={header.payoutConfig}
                />
              </div>

              {/* Right column */}
              <aside className="flex min-w-0 flex-col gap-gutter">
                <PoolOverviewCard pool={pool} />
                <RecentPayoutsFeed payouts={recentPayouts} />
                <SystemStatusCard items={systemStatus} />
              </aside>
            </div>
          </main>

          <footer
            className={[
              "rounded-tl-2xl rounded-bl-none",
              "rounded-tr-2xl rounded-br-2xl",
              "border border-border/60",
              "glass shadow-card-elevated surface-highlight",
              "flex flex-wrap items-center justify-between gap-3",
              "px-5 py-3",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <Badge variant="success" dot>
                {header.status}
              </Badge>
              <span className="text-caption text-fg-muted">
                Project · {slug}
              </span>
            </div>
            <div className="flex items-center gap-4 text-caption text-fg-muted">
              <span>
                {leaderboard.length} contributors ranked
              </span>
              <span aria-hidden>·</span>
              <span>Powered by BAGS.fm</span>
              <span aria-hidden>·</span>
              <span>devnet</span>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
