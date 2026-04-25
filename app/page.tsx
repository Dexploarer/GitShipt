import Link from "next/link";
import { ArrowUpRight, Github, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { PublicAppShell } from "@/components/public/PublicAppShell";
import { getLandingData, getGlobalLeaderboard } from "@/lib/queries/global";
import { HowItWorksSection } from "./_components/HowItWorksSection";
import { BentoTickerCell } from "./_components/BentoTicker";
import { TopProjectsGrid } from "./_components/TopProjectsGrid";
import { TopEarnersBento } from "./_components/TopEarnersBento";

/**
 * Landing page — bento layout with right-aligned hero. Inside PublicAppShell.
 *
 * Grid (lg+):
 *   Row 1: Hero (col-span-8, row-span-2) | Featured KPI (col-span-4)
 *   Row 2:                                 | Three KPI tiles (col-span-4)
 *   Row 3: Top projects (col-span-12)
 *   Row 4: How it works (col-span-8)       | Top earners (col-span-4)
 *
 * The hero is right-aligned (text-right + items-end) so the eye starts at
 * the sidebar on the left, sweeps right through the bento, and lands on
 * the dominant CTA cluster at the right edge — a deliberate "anchored to
 * the corner" composition rather than the usual centered marketing splash.
 */
export default async function LandingPage() {
  const [{ topProjects, ticker }, { byContributor }] = await Promise.all([
    getLandingData(),
    getGlobalLeaderboard(),
  ]);

  return (
    <PublicAppShell active="home">
      <div className="flex flex-col gap-4 py-2">
        {/* ───────── Bento grid header (Row 1 + Row 2) ───────── */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:grid-rows-[auto_auto]">
          {/* Hero — right-aligned, anchored to the corner */}
          <section className="relative flex flex-col items-end justify-end gap-5 overflow-hidden rounded-2xl border border-border/60 bg-surface/40 surface-highlight px-6 py-10 sm:px-10 sm:py-12 lg:col-span-8 lg:row-span-2 lg:px-14 lg:py-16">
            {/* Decorative left-side glyph (single primary anchor on the page) */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-6 top-6 hidden size-12 place-items-center rounded-2xl bg-primary text-bg shadow-card-elevated lg:grid"
            >
              <Sparkles className="size-6" />
            </div>

            <Pill variant="primary" size="default" className="gap-2">
              <span
                aria-hidden
                className="size-1.5 animate-pulse-dot rounded-full bg-success"
              />
              Live on Solana devnet
              <span aria-hidden className="text-fg-muted">·</span>
              April 28 hackathon submission
            </Pill>

            <h1 className="text-right text-display tracking-tight text-fg lg:text-[56px] lg:leading-[1.05]">
              Pump.fm
              <br />
              <span className="text-fg-muted">for open source.</span>
            </h1>

            <p className="max-w-md text-right text-body-lg text-fg-secondary">
              Spin up a Bags.fm token for any GitHub repo. Trading fees flow
              to top contributors automatically — daily, on-chain, transparent.
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
              className="inline-flex items-center gap-1.5 text-caption text-fg-muted transition-colors hover:text-fg"
            >
              <Github className="size-3.5" aria-hidden />
              SYMBaiEX/gitbags
              <ArrowUpRight className="size-3" />
            </Link>
          </section>

          {/* Featured KPI — large, dominates the right side of row 1 */}
          <div className="lg:col-span-4 lg:row-start-1">
            <BentoTickerCell
              initial={ticker}
              cellKey="fees"
              size="lg"
              className="h-full"
            />
          </div>

          {/* Three smaller KPI cells — row 2, right side */}
          <div className="lg:col-span-4 lg:col-start-9 lg:row-start-2">
            <div className="grid h-full grid-cols-3 gap-3">
              <BentoTickerCell initial={ticker} cellKey="volume" />
              <BentoTickerCell initial={ticker} cellKey="projects" />
              <BentoTickerCell initial={ticker} cellKey="earning" />
            </div>
          </div>
        </div>

        {/* ───────── Top projects ───────── */}
        <section className="flex flex-col gap-3">
          <header className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-headline-md leading-tight text-fg">
                Top projects
              </h2>
              <p className="text-body-sm text-fg-secondary">
                Repos paying the most to contributors right now.
              </p>
            </div>
            <Link
              href="/explore"
              className="inline-flex items-center gap-1 text-label-md text-fg-secondary transition-colors hover:text-fg"
            >
              View all
              <ArrowUpRight className="size-3.5" />
            </Link>
          </header>
          <TopProjectsGrid projects={topProjects} />
        </section>

        {/* ───────── How it works | Top earners ───────── */}
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
