import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Github, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { PublicAppShell } from "@/components/public/PublicAppShell";
import { formatSol } from "@/lib/format";
import {
  getLandingData,
  getGlobalLeaderboard,
  type LandingProject,
} from "@/lib/queries/global";
import { BentoTickerCell } from "./_components/BentoTicker";
import { TopEarnersBento } from "./_components/TopEarnersBento";

/**
 * Landing page — viewport-locked bento on lg+, scrollable column on mobile.
 *
 *   Row 1 (flex-1): Hero (cols 1-8) | Top earners list (cols 9-12)
 *   Row 2 (auto):   4 live KPI cells, full width
 *   Row 3 (auto):   3 top project cards, full width
 *
 * On lg+ the whole layout sits inside `h-[calc(100vh-4.5rem)] overflow-hidden`
 * — the page never scrolls; the only thing that gives is the Top earners
 * card's internal list, which already has its own overflow.
 */
export default async function LandingPage() {
  const [{ topProjects, ticker }, { byContributor }] = await Promise.all([
    getLandingData(),
    getGlobalLeaderboard(),
  ]);
  const featured = topProjects.slice(0, 3);

  return (
    <PublicAppShell active="home">
      <div className="flex flex-col gap-3 lg:h-[calc(100vh-4.5rem)] lg:gap-3 lg:overflow-hidden">
        {/* ── Row 1: hero + top earners ─────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-12">
          <section className="flex items-center lg:col-span-8 lg:min-h-0">
            <div className="grid w-full grid-cols-1 items-center gap-6 sm:grid-cols-[1fr_auto] sm:gap-8 lg:gap-10">
              <div className="flex flex-col items-start gap-3 lg:gap-4">
                <Pill variant="primary" size="default" className="gap-2">
                  <span
                    aria-hidden
                    className="size-1.5 animate-pulse-dot rounded-full bg-success"
                  />
                  GitBags · Live on Solana devnet
                </Pill>

                <h1 className="text-[36px] font-semibold leading-[1.04] tracking-[-0.02em] text-fg sm:text-[44px] lg:text-[52px]">
                  Your repo,
                  <br />
                  <span className="text-fg-muted">tokenized.</span>
                </h1>

                <p className="max-w-md text-body-md text-fg-secondary lg:text-body-lg">
                  GitBags turns any GitHub repository into a tradeable
                  Bags.fm token. Swap fees fund a daily on-chain SOL
                  payout to your top contributors — automatic,
                  transparent, no committee.
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-2.5">
                  <Button asChild variant="primary" size="lg">
                    <Link href="/launch">
                      Launch a token
                      <ArrowUpRight className="size-4" aria-hidden />
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="lg">
                    <Link href="/explore">Browse projects</Link>
                  </Button>
                </div>

                <Link
                  href="https://github.com/SYMBaiEX/gitbags"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-caption text-fg-muted transition-colors hover:text-fg"
                >
                  <Github className="size-3.5" aria-hidden />
                  SYMBaiEX/gitbags
                  <ArrowUpRight className="size-3" />
                </Link>
              </div>

              <div className="relative mx-auto aspect-square w-full max-w-[280px] shrink-0 sm:mx-0 sm:w-[280px] sm:max-w-none lg:w-[340px]">
                <Image
                  src="/mia.png"
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 1024px) 280px, 340px"
                  className="object-contain object-center"
                  unoptimized
                />
              </div>
            </div>
          </section>

          <aside className="lg:col-span-4 lg:min-h-0">
            <TopEarnersBento entries={byContributor} limit={6} />
          </aside>
        </div>

        {/* ── Row 2: live KPI strip (4 cells) ──────────────────────── */}
        <section
          aria-label="Live platform metrics"
          className="grid grid-cols-2 gap-2 lg:shrink-0 lg:grid-cols-4 lg:gap-3"
        >
          <BentoTickerCell initial={ticker} cellKey="fees" />
          <BentoTickerCell initial={ticker} cellKey="volume" />
          <BentoTickerCell initial={ticker} cellKey="projects" />
          <BentoTickerCell initial={ticker} cellKey="earning" />
        </section>

        {/* ── Row 3: top projects (3 cards) ────────────────────────── */}
        <section className="flex flex-col gap-2 lg:shrink-0">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-label-md text-fg-secondary">
              Top projects on GitBags
            </h2>
            <Link
              href="/explore"
              className="inline-flex items-center gap-1 text-label-sm text-fg-secondary transition-colors hover:text-fg"
            >
              View all
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          {featured.length === 0 ? (
            <Card depth="flat" padding="default" className="text-center">
              <p className="text-body-sm text-fg-secondary">
                No live projects yet — be the first to launch.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 lg:gap-3">
              {featured.map((p) => (
                <CompactProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </section>
      </div>
    </PublicAppShell>
  );
}

/**
 * Inline, condensed project card sized for the landing's bottom row —
 * smaller padding and one stat row instead of three so the whole landing
 * still fits in a single viewport on lg+.
 */
function CompactProjectCard({ project }: { project: LandingProject }) {
  const avatar =
    project.imageUrl ?? `https://github.com/${project.ghOwner}.png`;
  return (
    <Link href={`/r/${project.slug}`} className="group block">
      <Card
        depth="raised"
        padding="sm"
        className="flex h-full items-center gap-3 transition-colors group-hover:border-border-strong"
      >
        <Image
          src={avatar}
          alt=""
          width={36}
          height={36}
          className="size-9 shrink-0 rounded-md bg-surface-elevated"
          unoptimized
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-label-md font-semibold tracking-tight text-fg">
              {project.name}
            </h3>
            <Badge variant="success" size="sm" dot aria-label={`Status ${project.status}`}>
              {project.status}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-caption text-fg-muted">
            <span className="truncate">{project.slug}</span>
            <span aria-hidden>·</span>
            <span className="text-mono-sm text-fg-secondary">
              {formatSol(project.lifetimeFeesLamports, 1)}
            </span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1 text-mono-sm text-fg-secondary">
              <Users className="size-3" aria-hidden />
              {project.contributorsCount.toLocaleString("en-US")}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
