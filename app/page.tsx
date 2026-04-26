import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { PublicAppShell } from "@/components/public/PublicAppShell";
import { getLandingData, getGlobalLeaderboard } from "@/lib/queries/global";
import { HowItWorksSection } from "./_components/HowItWorksSection";
import { BentoTickerCell } from "./_components/BentoTicker";
import { TopProjectsGrid } from "./_components/TopProjectsGrid";
import { TopEarnersBento } from "./_components/TopEarnersBento";

/**
 * Landing page — floating content directly on bg, no heavy hero card.
 * Same visual vocabulary as the project page: text + chips on bg,
 * small bordered stat cells, raised cards only for the anchor sections
 * (Top projects grid, Top earners list).
 *
 * Sections:
 *   1. Hero — pill + headline + description + CTAs (no card wrapper)
 *   2. KPI strip — 4 floating live cells (TokenStatsRow vocabulary)
 *   3. Top projects — its own header + 3-col grid
 *   4. How it works (8 cols) | Top earners (4 cols)
 */
export default async function LandingPage() {
  const [{ topProjects, ticker }, { byContributor }] = await Promise.all([
    getLandingData(),
    getGlobalLeaderboard(),
  ]);

  return (
    <PublicAppShell active="home">
      <div className="flex flex-col gap-12 py-4">
        {/* Hero — image on the left (flipped on X), content right-aligned */}
        <section className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
          {/* Left: mia.png, horizontally flipped (-scale-x-100) */}
          <div className="relative mx-auto aspect-square w-full max-w-md lg:mx-0 lg:max-w-none">
            <Image
              src="/mia.png"
              alt=""
              fill
              priority
              sizes="(max-width: 1024px) 28rem, 50vw"
              className="-scale-x-100 object-contain object-center"
              unoptimized
            />
          </div>

          {/* Right: hero content, right-aligned */}
          <div className="flex flex-col items-end gap-5 text-right">
            <Pill variant="primary" size="default" className="gap-2">
              <span
                aria-hidden
                className="size-1.5 animate-pulse-dot rounded-full bg-success"
              />
              Live on Solana devnet
              <span aria-hidden className="text-fg-muted">·</span>
              April 28 hackathon submission
            </Pill>

            <h1 className="text-[44px] font-semibold leading-[1.05] tracking-[-0.02em] text-fg sm:text-[56px] lg:text-[64px]">
              Pump.fm{" "}
              <span className="text-fg-muted">for open source.</span>
            </h1>

            <p className="max-w-xl text-body-lg text-fg-secondary lg:text-[18px]">
              Spin up a Bags.fm token for any GitHub repo. Trading fees flow
              to the top contributors automatically — daily, on-chain,
              transparent.
            </p>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button asChild variant="secondary" size="lg">
                <Link href="/explore">Browse projects</Link>
              </Button>
              <Button asChild variant="primary" size="lg">
                <Link href="/launch">
                  Launch a token
                  <ArrowUpRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>

            <Link
              href="https://github.com/SYMBaiEX/gitbags"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-label-md text-fg-secondary transition-colors hover:text-fg"
            >
              <Github className="size-4" aria-hidden />
              SYMBaiEX/gitbags
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </section>

        {/* Live KPI strip — 4 floating cells, no Card wrapper */}
        <section
          aria-label="Live platform metrics"
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <BentoTickerCell initial={ticker} cellKey="fees" />
          <BentoTickerCell initial={ticker} cellKey="volume" />
          <BentoTickerCell initial={ticker} cellKey="projects" />
          <BentoTickerCell initial={ticker} cellKey="earning" />
        </section>

        {/* Top projects — owns its own header */}
        <TopProjectsGrid projects={topProjects} />

        {/* How it works | Top earners */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <section className="lg:col-span-8">
            <HowItWorksSection />
          </section>
          <section className="lg:col-span-4">
            <TopEarnersBento entries={byContributor} limit={5} />
          </section>
        </div>
      </div>
    </PublicAppShell>
  );
}
