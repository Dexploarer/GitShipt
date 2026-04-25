import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowUpRight, Github, Sparkles, Wallet } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-content items-center justify-between px-margin">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-bg">
              <Sparkles className="size-4" />
            </span>
            <span className="text-headline-sm tracking-tight">
              GitBags
              <span className="ml-2 text-label-sm font-normal text-fg-muted">
                by BAGS.fm
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/explore"
              className="rounded-md px-3 py-2 text-label-md text-fg-secondary transition-colors hover:bg-surface-elevated hover:text-fg"
            >
              Explore
            </Link>
            <Link
              href="/docs"
              className="rounded-md px-3 py-2 text-label-md text-fg-secondary transition-colors hover:bg-surface-elevated hover:text-fg"
            >
              Docs
            </Link>
            <ThemeToggle />
            <Link
              href="/auth/signin"
              className="ml-2 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-label-md text-fg transition-colors hover:bg-primary-hover"
            >
              <Github className="size-4" />
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-16 px-margin py-24">
        <section className="flex flex-col gap-8">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-label-sm text-primary">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-success" />
            Hackathon build · April 28 submission
          </span>
          <h1 className="max-w-3xl text-display tracking-tight">
            Pump.fm for open source.
            <br />
            <span className="text-fg-muted">The repo is the project.</span>
          </h1>
          <p className="max-w-xl text-body-lg text-fg-secondary">
            Spin up a Bags.fm token for any GitHub repo. Trading fees flow to
            the top contributors automatically — daily, on-chain, transparent.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/launch"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-label-md text-fg transition-colors hover:bg-primary-hover"
            >
              Launch a token
              <ArrowUpRight className="size-4" />
            </Link>
            <Link
              href="/explore"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-border-strong bg-surface-elevated px-5 text-label-md text-fg transition-colors hover:bg-surface-overlay"
            >
              Browse projects
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-gutter md:grid-cols-3">
          {[
            {
              icon: Github,
              title: "Index commits + PRs",
              body: "GitHub App pulls deltas every 15 minutes. Score uses merged PRs and default-branch commits, with linear time decay.",
            },
            {
              icon: Wallet,
              title: "Daily payouts",
              body: "Bags claim at 00:30 UTC. Top 10 contributors get tier-weighted SPL transfers; unclaimed lands in escrow.",
            },
            {
              icon: Sparkles,
              title: "On-chain transparent",
              body: "Snapshots are Merkle-rooted. Every payout has a tx signature. Audit log is append-only.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="rounded-lg border border-border bg-surface p-6"
            >
              <Icon className="size-5 text-primary" />
              <h3 className="mt-4 text-headline-sm">{title}</h3>
              <p className="mt-2 text-body-md text-fg-secondary">{body}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="border-t border-border px-margin py-6">
        <div className="mx-auto flex w-full max-w-content items-center justify-between text-caption text-fg-muted">
          <span>Powered by BAGS.fm API</span>
          <span>© {new Date().getFullYear()} GitBags</span>
        </div>
      </footer>
    </div>
  );
}
