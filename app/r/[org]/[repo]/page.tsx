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
 * Public project page (`/r/[org]/[repo]`). Server-rendered with one client
 * island (the countdown), the chart (Recharts), and the modal trigger.
 *
 * Layout: 240px sidebar + content area. Inside content: a 2-column main
 * (leaderboard left, supporting cards right). The header card and the
 * countdown sit side-by-side at the top.
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

  return (
    <div className="flex min-h-screen bg-bg text-fg">
      <ProjectSidebar header={header} pool={pool} canAdmin={false} />

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-content px-margin py-8">
          <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_380px]">
            {/* Left column */}
            <div className="flex min-w-0 flex-col gap-gutter">
              <div className="grid grid-cols-1 gap-gutter md:grid-cols-[minmax(0,1fr)_280px]">
                <ProjectHeader header={header} />
                <NextPayoutCountdown
                  targetIso={nextPayoutAt.toISOString()}
                />
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
        </div>
      </main>
    </div>
  );
}
