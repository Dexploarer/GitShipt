import { Github } from "@repo/ui";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Trophy } from "lucide-react";
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
import {
  BentoTickerCell,
  getLandingTickerCellKeys,
} from "../_components/BentoTicker";
const FEATURED_OWNER = "SYMBaiEX";
const FEATURED_REPO = "gitshipt";

/**
 * Landing page — viewport-locked bento on lg+, scrollable column on mobile.
 *
 *   Row 1 (flex-1): Hero (cols 1-8) | Featured project: GitShipt (cols 9-12)
 *   Row 2 (auto):   4 live KPI cells, full width
 *
 * The featured project is the GitShipt repo itself — debuts the project on
 * its own landing and shows the contributors who actually built it.
 */

export default function LandingPage() {
  return (
    <Suspense fallback={null}>
      <LandingPageContent />
    </Suspense>
  );
}

async function LandingPageContent() {
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
  const tickerCellKeys = getLandingTickerCellKeys(ticker);

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
      <div className="grid grid-cols-1 gap-4 lg:mb-2 lg:min-h-0 lg:grid-cols-[minmax(0,480px)_minmax(0,900px)] lg:justify-center lg:gap-8">
        <div className="contents lg:flex lg:flex-col lg:min-h-0 lg:justify-center lg:gap-10">
          <section className="order-1 flex flex-col items-start gap-4 lg:order-none lg:gap-5">
            <h1 className="text-display text-fg">
              Your repo, <span className="text-fg-muted">tokenized.</span>
            </h1>

            <p className="max-w-xl text-body-md text-fg-secondary">
              GitShipt mints a Bags.fm token for any GitHub repo and streams the
              trading fees back to its contributors — ranked daily, paid
              on-chain in SOL.
            </p>

            <Link
              href="https://github.com/SYMBaiEX/gitshipt"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-caption text-fg-muted transition-colors hover:text-fg"
            >
              <Github className="size-3.5" aria-hidden />
              SYMBaiEX/gitshipt
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
          <div className="gitshipt-mia-stage pointer-events-none relative order-2 mx-auto aspect-square w-full max-w-[420px] sm:max-w-[540px] lg:order-none lg:aspect-auto lg:mx-0 lg:h-[820px] lg:w-full lg:max-w-none lg:shrink-0">
            <Image
              src="/mia.png"
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 420px, (max-width: 1024px) 540px, 900px"
              className="gitshipt-mia-art z-[1] object-contain object-bottom"
              unoptimized
            />
            <div
              aria-hidden="true"
              className="gitshipt-flag-wave absolute right-[8%] top-[-4%] z-[3] w-[140px] sm:w-[180px] lg:w-[240px]"
            >
              <Image
                src="/flag.png"
                alt=""
                width={480}
                height={640}
                sizes="(max-width: 640px) 140px, (max-width: 1024px) 180px, 240px"
                className="gitshipt-flag-art h-auto w-full select-none object-contain"
                unoptimized
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: ship marker + live KPI strip (above footer) ──── */}
      <div className="relative lg:shrink-0">
        <div
          aria-hidden="true"
          className="gitshipt-ship-float pointer-events-none absolute -top-12 left-1/2 z-[2] w-[140px] -translate-x-1/2 sm:w-[180px] lg:-top-16 lg:w-[220px]"
        >
          <Image
            src="/ship.png"
            alt=""
            width={440}
            height={293}
            sizes="(max-width: 640px) 140px, (max-width: 1024px) 180px, 220px"
            className="gitshipt-ship-art h-auto w-full select-none object-contain"
            unoptimized
          />
        </div>
        <section
          aria-label="Live platform metrics"
          className={
            tickerCellKeys.length === 4
              ? "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3"
              : "grid grid-cols-1 gap-2 sm:grid-cols-3 lg:gap-3"
          }
        >
          {tickerCellKeys.map((cellKey) => (
            <BentoTickerCell key={cellKey} initial={ticker} cellKey={cellKey} />
          ))}
        </section>
      </div>
    </div>
  );
}

/**
 * Featured-project bento card — debuts the GitShipt repo on its own landing.
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
          <h2 className="text-label-sm uppercase text-fg-muted">
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
        <span className="text-label-sm uppercase text-fg-muted">
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
