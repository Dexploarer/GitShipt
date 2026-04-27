import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Github, Trophy } from "lucide-react";
import { Badge } from "@repo/ui";
import { Button } from "@repo/ui";
import { Card } from "@repo/ui";
import { getLandingData } from "@/lib/queries/global";
import {
  getProjectBySlug,
  getProjectLeaderboard,
  type LeaderboardRow,
  type ProjectHeader,
} from "@/lib/queries/project-page";
import { BentoTickerCell } from "../_components/BentoTicker";

const FEATURED_OWNER = "SYMBaiEX";
const FEATURED_REPO = "gitbags";
const MIA_LOGO_OVERLAYS = [
  {
    position: "left-[25%] top-[32%]",
    size: "size-[72px] sm:size-[92px] lg:size-[132px]",
    drift: "gitbags-logo-float-a",
    tilt: "-rotate-12 -skew-y-6",
  },
  {
    position: "right-[23%] top-[25%]",
    size: "size-16 sm:size-[84px] lg:size-[120px]",
    drift: "gitbags-logo-float-b",
    tilt: "rotate-10 skew-y-6",
  },
  {
    position: "left-[37%] top-[45%]",
    size: "size-12 sm:size-[66px] lg:size-[88px]",
    drift: "gitbags-logo-float-c",
    tilt: "rotate-6 -skew-y-3",
  },
  {
    position: "right-[19%] top-[35%]",
    size: "size-12 sm:size-[66px] lg:size-[92px]",
    drift: "gitbags-logo-float-d",
    tilt: "-rotate-8 skew-y-3",
  },
] as const;

/**
 * Landing page — viewport-locked bento on lg+, scrollable column on mobile.
 *
 *   Row 1 (flex-1): Hero (cols 1-8) | Featured project: GitBags (cols 9-12)
 *   Row 2 (auto):   4 live KPI cells, full width
 *
 * The featured project is the GitBags repo itself — debuts the project on
 * its own landing and shows the contributors who actually built it.
 */
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [{ ticker }, featuredHeader] = await Promise.all([
    getLandingData(),
    getProjectBySlug(FEATURED_OWNER, FEATURED_REPO),
  ]);
  const featuredContribs: LeaderboardRow[] = featuredHeader
    ? await getProjectLeaderboard(
        featuredHeader.id,
        featuredHeader.payoutConfig,
      )
    : [];

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100vh-4.5rem)] lg:gap-3 lg:overflow-hidden lg:pt-8">
      {/* ── Row 1: two columns ─────────────────────────────────────
              Left  (cols 1-7): hero text on top, featured project below
              Right (cols 8-12): mia visual
        */}
      {/*
          Two-column layout uses `lg:contents` on each column wrapper so
          children flow as direct grid items below lg. That lets us reorder
          via `order-*` so the mobile reading flow is: text → visual →
          featured-project → CTAs, instead of text → featured → visual → CTAs.
        */}
      <div className="grid grid-cols-1 gap-4 lg:mb-8 lg:min-h-0 lg:grid-cols-[minmax(0,520px)_minmax(0,760px)] lg:justify-center lg:gap-8">
        <div className="contents lg:flex lg:flex-col lg:min-h-0 lg:justify-center lg:gap-10">
          <section className="order-1 flex flex-col items-start gap-4 lg:order-none lg:gap-5">
            <h1 className="text-[28px] font-semibold leading-[1.02] text-fg sm:text-[36px] lg:whitespace-nowrap lg:text-[52px]">
              Your repo, <span className="text-fg-muted">tokenized.</span>
            </h1>

            <p className="max-w-xl text-body-md text-fg-secondary lg:text-body-lg">
              GitBags mints a Bags.fm token for any GitHub repo and streams the
              trading fees back to its contributors — ranked daily, paid
              on-chain in SOL.
            </p>

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

          <div className="order-3 flex w-full flex-col gap-10 lg:order-none lg:w-[440px]">
            <div className="w-full lg:max-h-[320px] lg:min-h-0">
              <FeaturedProjectCard
                header={featuredHeader}
                contributors={featuredContribs}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
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
          </div>
        </div>

        <div className="contents lg:flex lg:min-h-0 lg:flex-col lg:justify-end lg:gap-0">
          <div className="gitbags-mia-stage pointer-events-none relative order-2 mx-auto aspect-square w-full max-w-[360px] sm:max-w-[460px] lg:order-none lg:aspect-auto lg:mx-0 lg:h-[700px] lg:w-full lg:max-w-none lg:shrink-0">
            <Image
              src="/mia.png"
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 360px, (max-width: 1024px) 460px, 700px"
              className="gitbags-mia-art z-[1] object-contain object-bottom"
              unoptimized
            />
            {MIA_LOGO_OVERLAYS.map((logo) => (
              <span
                key={`${logo.position}-${logo.size}`}
                aria-hidden="true"
                className={`${logo.position} ${logo.size} ${logo.drift} gitbags-logo-float absolute z-10 block`}
              >
                <Image
                  src="/logo.png"
                  alt=""
                  fill
                  sizes="(max-width: 640px) 72px, (max-width: 1024px) 92px, 132px"
                  className={`${logo.tilt} gitbags-logo-mark select-none object-contain`}
                  unoptimized
                />
              </span>
            ))}
          </div>
        </div>
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
      <p className="text-caption text-fg-muted lg:shrink-0">
        24h volume is simulated until Bags market data is configured; fees and
        earners come from payout records.
      </p>
    </div>
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
      <Card
        depth="raised"
        padding="lg"
        className="flex h-full items-center justify-center text-center"
      >
        <p className="text-body-sm text-fg-muted">
          Featured project not seeded yet.
        </p>
      </Card>
    );
  }

  const avatar = header.imageUrl ?? `https://github.com/${header.ghOwner}.png`;
  const top = contributors.slice(0, 25);
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
          <h2 className="text-label-sm uppercase tracking-wider text-fg-muted">
            Featured project
          </h2>
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
        <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-surface-elevated">
          <Image
            src={avatar}
            alt=""
            fill
            sizes="40px"
            className="object-cover"
            unoptimized
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-headline-sm text-fg">{header.name}</h3>
            <Badge variant="success" size="sm" dot>
              {header.status}
            </Badge>
          </div>
          <p className="truncate text-caption text-fg-muted">{header.slug}</p>
        </div>
      </Link>

      <div className="grid grid-cols-3 gap-2 border-y border-border/60 bg-bg/30 px-4 py-2.5">
        <Stat
          label="Devs"
          value={header.contributorsCount.toLocaleString("en-US")}
        />
        <Stat label="Stars" value={header.stars.toLocaleString("en-US")} />
        <Stat label="Forks" value={header.forks.toLocaleString("en-US")} />
      </div>

      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1.5">
        <span className="text-label-sm uppercase tracking-wider text-fg-muted">
          Top contributors
        </span>
        <Link
          href={projectHref}
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
                    <span className="relative size-5 shrink-0 overflow-hidden rounded-sm bg-surface-elevated">
                      <Image
                        src={c.avatarUrl}
                        alt=""
                        fill
                        sizes="20px"
                        className="object-cover"
                        unoptimized
                      />
                    </span>
                  ) : null}
                  <span className="truncate text-label-md text-fg">
                    {c.ghUsername}
                  </span>
                </span>
                <span className="text-mono-sm text-fg-secondary tabular-nums">
                  {Math.round(c.weightPercent)}% share
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
