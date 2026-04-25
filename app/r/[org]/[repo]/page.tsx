import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Github, Twitter } from "lucide-react";
import { getProjectPageData } from "@/lib/queries/project-page";
import { getTokenStats } from "@/lib/queries/token-stats";
import { ProjectHeader } from "./_components/ProjectHeader";
import { NextPayoutCountdown } from "./_components/NextPayoutCountdown";
import { LeaderboardTable } from "./_components/LeaderboardTable";
import { PoolOverviewCard } from "./_components/PoolOverviewCard";
import { RecentPayoutsFeed } from "./_components/RecentPayoutsFeed";
import { RepoStatsList } from "./_components/RepoStatsList";
import { TokenStatsRow } from "./_components/TokenStatsRow";
import { TokenActionsMenu } from "./_components/TokenActionsMenu";
import { ProjectSidebar } from "@/components/sidebar/ProjectSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

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

  const { header, leaderboard, pool, recentPayouts, nextPayoutAt } = data;
  const slug = `${header.ghOwner}/${header.ghRepo}`;
  const tokenStats = await getTokenStats(header);

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
          {/* Bento shell. Mobile (< lg): vertical scroll, single column.
              Desktop (lg+): the page slots into the viewport — main is
              overflow-hidden, header spans both cols, leaderboard +
              right-rail fill the remaining height with their own internal
              scroll where needed. No page scroll, no double-scrollbars. */}
          <main className="min-w-0 flex-1 overflow-y-auto px-4 pt-4 pb-3 lg:overflow-hidden">
            <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_auto_minmax(0,1fr)]">
              {/* Row 1: hero (avatar + name + description) | repo stats list */}
              <div className="min-w-0 lg:self-start">
                <ProjectHeader header={header} />
              </div>
              <div className="min-w-0 lg:self-start">
                <RepoStatsList
                  header={header}
                  action={
                    <TokenActionsMenu
                      tokenMint={tokenStats?.tokenMint ?? null}
                      ghOwner={header.ghOwner}
                      ghRepo={header.ghRepo}
                    />
                  }
                />
              </div>

              {/* Row 2 col 1: token stats strip — width-matched to the
                  leaderboard column so it never extends past it. */}
              <div className="min-w-0 lg:col-start-1">
                <TokenStatsRow stats={tokenStats} />
              </div>

              {/* Row 2-3 col 2: aside spans both rows so the right rail
                  starts higher up, fills the available height, and the
                  countdown isn't pinched by row 3's flex height. */}
              <aside className="flex min-w-0 flex-col gap-3 lg:col-start-2 lg:row-span-2 lg:row-start-2 lg:min-h-0 lg:overflow-y-auto lg:[scrollbar-width:thin] lg:[scrollbar-color:var(--border-strong)_transparent]">
                <NextPayoutCountdown targetIso={nextPayoutAt.toISOString()} />
                <PoolOverviewCard pool={pool} />
                <RecentPayoutsFeed payouts={recentPayouts} />
              </aside>

              {/* Row 3 col 1: leaderboard fills the remaining vertical space */}
              <div className="min-w-0 lg:col-start-1 lg:row-start-3 lg:min-h-0">
                <LeaderboardTable
                  rows={leaderboard}
                  dailyFeeLamports={pool.dailyFeeLamports}
                  dailyFeeUsd={pool.dailyFeeUsd}
                  scoringConfig={header.scoringConfig}
                  payoutConfig={header.payoutConfig}
                />
              </div>
            </div>
          </main>

          <footer
            className={[
              "shrink-0 ml-4",
              // Anchored bottom-right of viewport: top-left rounded toward
              // the sidebar, the right side runs flush to the viewport edge.
              "rounded-tl-2xl",
              "border-t border-l border-border/60",
              "glass shadow-card-elevated surface-highlight",
              "flex items-center justify-between gap-3",
              "px-4 py-1.5",
            ].join(" ")}
          >
            <span className="truncate text-caption text-fg-muted">
              {slug} · devnet · BAGS.fm
            </span>
            <div className="flex items-center gap-1">
              <SocialLink
                href={`https://github.com/${header.ghOwner}/${header.ghRepo}`}
                label="GitHub repo"
              >
                <Github className="size-4" />
              </SocialLink>
              <SocialLink href="https://x.com/bagsdotfm" label="Bags on X">
                <Twitter className="size-4" />
              </SocialLink>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      className="inline-flex size-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-elevated hover:text-fg"
    >
      {children}
    </Link>
  );
}
