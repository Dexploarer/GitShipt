import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Github, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PublicAppShell } from "@/components/public/PublicAppShell";
import { formatSol } from "@/lib/format";
import { getLandingData } from "@/lib/queries/global";
import {
  getProjectBySlug,
  getProjectLeaderboard,
  type LeaderboardRow,
  type ProjectHeader,
} from "@/lib/queries/project-page";
import { BentoTickerCell } from "./_components/BentoTicker";

const FEATURED_OWNER = "SYMBaiEX";
const FEATURED_REPO = "gitbags";

/**
 * Landing page — viewport-locked bento on lg+, scrollable column on mobile.
 *
 *   Row 1 (flex-1): Hero (cols 1-8) | Featured project: GitBags (cols 9-12)
 *   Row 2 (auto):   4 live KPI cells, full width
 *
 * The featured project is the GitBags repo itself — debuts the project on
 * its own landing and shows the contributors who actually built it.
 */
export default async function LandingPage() {
  const [{ ticker }, featuredHeader] = await Promise.all([
    getLandingData(),
    getProjectBySlug(FEATURED_OWNER, FEATURED_REPO),
  ]);
  const featuredContribs: LeaderboardRow[] = featuredHeader
    ? await getProjectLeaderboard(featuredHeader.id, featuredHeader.payoutConfig)
    : [];

  return (
    <PublicAppShell active="home">
      <div className="flex flex-col gap-3 lg:h-[calc(100vh-4.5rem)] lg:gap-3 lg:overflow-hidden">
        {/* ── Row 1: two columns ─────────────────────────────────────
              Left  (cols 1-7): hero text on top, featured project below
              Right (cols 8-12): mia.png, full row height
        */}
        <div className="grid grid-cols-1 gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-12">
          <div className="flex flex-col gap-3 lg:col-span-7 lg:min-h-0">
            <section className="flex flex-col items-start gap-3 lg:gap-4">
              <h1 className="text-[36px] font-semibold leading-[1.04] tracking-[-0.02em] text-fg sm:text-[44px] lg:text-[56px]">
                Your repo,
                <br />
                <span className="text-fg-muted">tokenized.</span>
              </h1>

              <p className="max-w-xl text-body-md text-fg-secondary lg:text-body-lg">
                GitBags turns any GitHub repository into a tradeable
                Bags.fm token. Swap fees fund a daily on-chain SOL
                payout to your top contributors — automatic, transparent,
                no committee.
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
            </section>

            <div className="lg:min-h-0 lg:flex-1">
              <FeaturedProjectCard
                header={featuredHeader}
                contributors={featuredContribs}
              />
            </div>
          </div>

          <aside className="relative lg:col-span-5 lg:min-h-0">
            <div className="pointer-events-none relative mx-auto aspect-square w-full max-w-[460px] sm:max-w-[520px] lg:absolute lg:inset-0 lg:aspect-auto lg:h-full lg:w-full lg:max-w-none">
              <Image
                src="/mia.png"
                alt=""
                fill
                priority
                sizes="(max-width: 1024px) 520px, 600px"
                className="object-contain object-bottom"
                unoptimized
              />
            </div>
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
      </div>
    </PublicAppShell>
  );
}

/**
 * Featured-project bento card — debuts the GitBags repo on its own landing.
 * Top: project header (avatar, name, slug, status, stat row).
 * Bottom: scrollable list of top contributors with rank medal, avatar,
 * username, and score. Whole card links into the project page.
 */
function FeaturedProjectCard({
  header,
  contributors,
}: {
  header: ProjectHeader | null;
  contributors: LeaderboardRow[];
}) {
  if (!header) {
    return (
      <Card depth="raised" padding="lg" className="flex h-full items-center justify-center text-center">
        <p className="text-body-sm text-fg-muted">
          Featured project not seeded yet.
        </p>
      </Card>
    );
  }

  const avatar =
    header.imageUrl ?? `https://github.com/${header.ghOwner}.png`;
  const top = contributors.slice(0, 6);
  const projectHref = `/r/${header.slug}`;

  return (
    <Card
      depth="raised"
      padding="none"
      className="flex h-full flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
        <div className="inline-flex items-center gap-2">
          <Trophy className="size-4 text-fg-secondary" aria-hidden />
          <span className="text-label-sm uppercase tracking-wider text-fg-muted">
            Featured project
          </span>
        </div>
        <Link
          href={projectHref}
          className="inline-flex items-center gap-1 text-label-sm text-fg-secondary transition-colors hover:text-fg"
        >
          Open
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <Link
        href={projectHref}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-elevated/40"
      >
        <Image
          src={avatar}
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-md bg-surface-elevated"
          unoptimized
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-headline-sm text-fg">
              {header.name}
            </h3>
            <Badge variant="success" size="sm" dot>
              {header.status}
            </Badge>
          </div>
          <p className="truncate text-caption text-fg-muted">{header.slug}</p>
        </div>
      </Link>

      <div className="grid grid-cols-3 gap-2 border-y border-border/60 bg-bg/30 px-4 py-2.5">
        <Stat label="Devs" value={header.contributorsCount.toLocaleString("en-US")} />
        <Stat label="Stars" value={header.stars.toLocaleString("en-US")} />
        <Stat label="Forks" value={header.forks.toLocaleString("en-US")} />
      </div>

      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1.5">
        <span className="text-label-sm uppercase tracking-wider text-fg-muted">
          Top contributors
        </span>
        <Link
          href={`${projectHref}/leaderboard`}
          className="text-label-sm text-fg-secondary transition-colors hover:text-fg"
        >
          Leaderboard →
        </Link>
      </div>

      {top.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-6 text-center text-body-sm text-fg-muted">
          No contributors indexed yet.
        </div>
      ) : (
        <ul className="flex flex-1 flex-col divide-y divide-border/60 overflow-y-auto">
          {top.map((c) => (
            <li key={c.contributorId}>
              <Link
                href={`/u/${c.ghUsername}`}
                className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 transition-colors hover:bg-surface-elevated/40"
              >
                <RankMedal rank={c.rank} />
                <span className="inline-flex min-w-0 items-center gap-2">
                  {c.avatarUrl ? (
                    <Image
                      src={c.avatarUrl}
                      alt=""
                      width={20}
                      height={20}
                      className="size-5 shrink-0 rounded-sm bg-surface-elevated"
                      unoptimized
                    />
                  ) : null}
                  <span className="truncate text-label-md text-fg">
                    {c.ghUsername}
                  </span>
                </span>
                <span className="text-mono-sm text-fg-secondary tabular-nums">
                  {formatSol(BigInt(Math.round(c.weight * 1e9)), 2)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-caption text-fg-muted">{label}</span>
      <span className="text-mono-sm text-fg">{value}</span>
    </div>
  );
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="grid size-5 place-items-center rounded-sm bg-rank-gold text-bg text-mono-sm font-medium">
        {rank}
      </span>
    );
  if (rank === 2)
    return (
      <span className="grid size-5 place-items-center rounded-sm bg-rank-silver text-bg text-mono-sm font-medium">
        {rank}
      </span>
    );
  if (rank === 3)
    return (
      <span className="grid size-5 place-items-center rounded-sm bg-rank-bronze text-bg text-mono-sm font-medium">
        {rank}
      </span>
    );
  return (
    <span className="grid size-5 place-items-center text-mono-sm text-fg-muted">
      {rank}
    </span>
  );
}
