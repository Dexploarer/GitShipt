import Link from "next/link";
import { ArrowUpRight, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { PublicAppShell } from "@/components/public/PublicAppShell";
import { getLandingData } from "@/lib/queries/global";
import { HowItWorksSection } from "./_components/HowItWorksSection";
import { LiveTicker } from "./_components/LiveTicker";
import { TopProjectsGrid } from "./_components/TopProjectsGrid";

/**
 * Landing page — the public marketing surface for GitBags. Server-rendered
 * end-to-end except for the `<LiveTicker>` island. Sections, top to bottom:
 *
 *   1. Hero (no card — floats on bg)
 *   2. Live ticker (client island, KPIs that shimmer)
 *   3. Top projects (Card depth=raised grid)
 *   4. How it works (3-step explainer, depth=flat)
 *
 * Wrapped in `<PublicAppShell>` — same viewport-locked sidebar layout used
 * on /r/[org]/[repo] and the dashboard, with a public-nav `<PublicSidebar>`.
 */
export default async function LandingPage() {
  const { topProjects, ticker } = await getLandingData();

  return (
    <PublicAppShell active="home">
      <div className="flex flex-col gap-12 py-2">
        {/* Hero */}
        <section className="flex flex-col items-start gap-6">
          <Pill variant="primary" size="default" className="gap-2">
            <span
              aria-hidden
              className="size-1.5 animate-pulse-dot rounded-full bg-success"
            />
            Live on Solana devnet
            <span aria-hidden className="text-fg-muted">
              ·
            </span>
            April 28 hackathon submission
          </Pill>

          <h1 className="text-display tracking-tight text-fg">
            Pump.fm for open source.
            <br />
            <span className="text-fg-muted">The repo is the project.</span>
          </h1>

          <p className="max-w-xl text-body-lg text-fg-secondary">
            Spin up a Bags.fm token for any GitHub repo. Trading fees flow to
            the top contributors automatically — daily, on-chain, transparent.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="primary" size="lg">
              <Link href="/launch">
                Launch a token
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/explore">
                Browse projects
              </Link>
            </Button>
            <Link
              href="https://github.com/bagsdotfm"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 px-2 py-2 text-label-md text-fg-secondary transition-colors hover:text-fg"
            >
              <Github className="size-4" aria-hidden />
              GitHub
            </Link>
          </div>
        </section>

        {/* Live ticker — client island for the heartbeat animation. */}
        <LiveTicker initial={ticker} />

        {/* Top projects */}
        <TopProjectsGrid projects={topProjects} />

        {/* How it works */}
        <HowItWorksSection />
      </div>
    </PublicAppShell>
  );
}
