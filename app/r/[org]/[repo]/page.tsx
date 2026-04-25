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
      {/* App shell: viewport-locked. Only <main> scrolls. Sidebar + footer stay
          pinned. Outer container has 12px left/top gutter only — the right
          column extends to viewport right edge, and the footer to viewport
          bottom edge, so the footer feels "anchored" to the corner of the
          screen with only its top-left rounded toward the sidebar. */}
      <div className="flex h-screen overflow-hidden bg-bg text-fg">
        <div className="shrink-0 p-3 pr-0">
          <ProjectSidebar
            slug={slug}
            active="leaderboard"
            canAdmin={false}
            token={{ header, pool }}
            wallet={{}}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="min-w-0 flex-1 overflow-y-auto px-3 pt-3 pb-3">
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
              "shrink-0 mx-3",
              // Width-matched to the main content column (mx-3 mirrors main's
              // px-3 inset). Top-left + top-right rounded so the bar reads as
              // a floating ribbon; bottom flush to viewport.
              "rounded-tl-2xl rounded-tr-2xl rounded-bl-none rounded-br-none",
              "border-t border-x border-border/60",
              "glass shadow-card-elevated surface-highlight",
              "flex items-center justify-between gap-4",
              "px-4 py-2",
            ].join(" ")}
          >
            <div className="flex min-w-0 items-center gap-2">
              <Badge variant="success" dot size="sm">
                {header.status}
              </Badge>
              <span className="truncate text-caption text-fg-muted">{slug}</span>
            </div>
            <span className="shrink-0 text-caption text-fg-muted">
              devnet · BAGS.fm
            </span>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
