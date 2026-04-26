import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ExternalLink } from "lucide-react";
import { getProjectPageData } from "@/lib/queries/project-page";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { ProjectShell } from "../_components/ProjectShell";
import { formatSol } from "@/lib/format";

type Params = Promise<{ org: string; repo: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { org, repo } = await params;
  const data = await getProjectPageData(org, repo);
  if (!data) return { title: `${org}/${repo} · Docs` };
  return {
    title: `${data.header.name} · Docs`,
    description: `How rewards work for ${data.header.slug}.`,
  };
}

export default async function ProjectDocsPage({ params }: { params: Params }) {
  const { org, repo } = await params;
  const data = await getProjectPageData(org, repo);
  if (!data) notFound();

  const { header, pool } = data;
  const repoUrl = `https://github.com/${header.ghOwner}/${header.ghRepo}`;
  const platformFeePct = (header.platformFeeBps / 100).toFixed(1);
  const contributorPoolPct = (
    (10_000 - header.platformFeeBps) /
    100
  ).toFixed(1);

  return (
    <ProjectShell header={header} pool={pool} active="docs">
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-2">
          <Breadcrumbs
            items={[
              { label: "Projects", href: "/explore" },
              {
                label: header.name,
                href: `/r/${header.ghOwner}/${header.ghRepo}`,
              },
              { label: "Docs" },
            ]}
          />
          <h1 className="text-headline-lg leading-tight text-fg">
            Docs for contributors
          </h1>
          <p className="text-body-md text-fg-secondary">
            How {header.name}'s payouts work, how to claim, and where to start
            contributing.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
          {/* Sticky TOC */}
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <nav className="flex flex-col gap-1 text-body-sm">
              {[
                ["how-rewards-work", "How rewards work"],
                ["claiming-earnings", "Claiming earnings"],
                ["scoring-this-project", "Scoring (this project)"],
                ["contributing", "How to contribute"],
                ["limits-and-faqs", "Limits & FAQs"],
              ].map(([id, label]) => (
                <Link
                  key={id}
                  href={`#${id}`}
                  className="rounded-md px-2 py-1 text-fg-secondary transition-colors hover:bg-surface-elevated hover:text-fg"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </aside>

          {/* Article */}
          <article className="flex flex-col gap-6 max-w-prose">
            <Section id="how-rewards-work" title="How rewards work">
              <p>
                {header.name} mints a token on{" "}
                <a
                  href="https://bags.fm"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-fg underline-offset-4 hover:underline"
                >
                  Bags.fm
                </a>
                . Every trade on that token generates fees. {platformFeePct}%
                goes to the GitBags platform; the remaining{" "}
                <span className="text-mono-sm text-primary">
                  {contributorPoolPct}%
                </span>{" "}
                is the contributor pool.
              </p>
              <p>
                Once a day at <span className="text-mono-sm">00:30 UTC</span>,
                the platform claims the contributor pool from Bags and sends
                each contributor a share of SOL based on their leaderboard
                rank. The split is tier-weighted —{" "}
                {header.payoutConfig.topN > 0
                  ? `${(header.payoutConfig.tierWeights[0]! * 100).toFixed(0)}% to rank 1, ${(header.payoutConfig.tierWeights[1]! * 100).toFixed(0)}% to rank 2, ${(header.payoutConfig.tierWeights[2]! * 100).toFixed(0)}% to rank 3, and the rest distributed across ranks 4–${header.payoutConfig.topN}.`
                  : "see the Token tab for current weights."}
              </p>
            </Section>

            <Section id="claiming-earnings" title="Claiming earnings">
              <p>
                Sign in with your GitHub account, then sign a Sign-In-With-Solana
                (SIWS) message to link a Solana wallet. Once linked, future
                payouts route directly to that wallet. Anything earned BEFORE
                you link is held in escrow and drains automatically the moment
                you link a wallet.
              </p>
              <p>
                You don't need to do anything per-cycle. The cron job picks up
                your latest linked address and includes you in the next snapshot.
              </p>
            </Section>

            <Section id="scoring-this-project" title="Scoring (this project)">
              <p>This project uses the GitBags v0 scoring formula:</p>
              <pre className="overflow-x-auto rounded-md border border-border bg-surface px-4 py-3 text-mono-sm text-fg">
                {`score = ${header.scoringConfig.weights.mergedPRs} × mergedPRs
      + ${header.scoringConfig.weights.commits} × commits
      + ${header.scoringConfig.weights.reviews} × reviews
      + ${header.scoringConfig.weights.issues} × issues
      + ${header.scoringConfig.weights.netLines} × log10(1 + netLines)`}
              </pre>
              <ul className="list-disc pl-5 text-body-md text-fg-secondary">
                <li>
                  Window:{" "}
                  <span className="text-mono-sm text-fg">
                    {header.scoringConfig.windowDays} days
                  </span>
                  . Older contributions are weighted by{" "}
                  <span className="text-mono-sm text-fg">
                    {header.scoringConfig.decay}
                  </span>{" "}
                  decay.
                </li>
                <li>
                  Self-merged PRs are weighted{" "}
                  <span className="text-mono-sm text-fg">0.5×</span>.
                </li>
                <li>
                  Bot accounts (
                  <span className="text-mono-sm">
                    /^(.*-bot|dependabot|.*-ci|renovate)$/
                  </span>
                  ) are excluded.
                </li>
                {header.scoringConfig.botBlocklist.length > 0 ? (
                  <li>
                    Project-specific blocklist:{" "}
                    <span className="text-mono-sm text-fg">
                      {header.scoringConfig.botBlocklist.join(", ")}
                    </span>
                  </li>
                ) : null}
              </ul>
              <p>
                Top {header.payoutConfig.topN} contributors get paid each cycle.
                Minimum daily pool to fire a payout:{" "}
                <span className="text-mono-sm text-fg">
                  {formatSol(
                    BigInt(header.payoutConfig.claimThresholdLamports),
                    4,
                  )}
                </span>
                .
              </p>
            </Section>

            <Section id="contributing" title="How to contribute">
              <p>
                Open a pull request on{" "}
                <a
                  href={repoUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-fg underline-offset-4 hover:underline"
                >
                  {header.ghOwner}/{header.ghRepo}
                  <ExternalLink className="size-3" />
                </a>
                . Once it merges, it counts toward the next snapshot at midnight
                UTC. Commits to the default branch count too.
              </p>
              <p className="text-caption text-fg-muted">
                Want repo-specific contribution guidelines? Check the project's
                CONTRIBUTING.md on GitHub.
              </p>
            </Section>

            <Section id="limits-and-faqs" title="Limits &amp; FAQs">
              <ul className="list-disc pl-5 text-body-md text-fg-secondary">
                <li>
                  <strong>What if I don't have a wallet?</strong> Earnings hold
                  in escrow for 30 days. Link a wallet to claim retroactively.
                </li>
                <li>
                  <strong>Can scoring change?</strong> The owner can adjust
                  weights and the topN. Each snapshot stores its formula
                  version, so historical payouts are reproducible.
                </li>
                <li>
                  <strong>Where do I see my earnings?</strong> Visit your{" "}
                  <Link
                    href="/u/{your-github-username}"
                    className="text-fg underline-offset-4 hover:underline"
                  >
                    contributor profile
                  </Link>{" "}
                  at <span className="text-mono-sm">/u/{`<your-github-username>`}</span>.
                </li>
                <li>
                  <strong>Where do I report abuse?</strong> See the{" "}
                  <Link
                    href="/docs"
                    className="text-fg underline-offset-4 hover:underline"
                  >
                    platform docs
                  </Link>{" "}
                  for moderation contact.
                </li>
              </ul>
            </Section>

            <Card depth="flat" padding="sm" className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="size-4 text-fg-secondary" />
                  More
                </CardTitle>
              </CardHeader>
              <CardContent className="mt-2 flex flex-wrap gap-3 text-body-sm text-fg-secondary">
                <Link href="/docs" className="text-fg underline-offset-4 hover:underline">
                  Platform docs
                </Link>
                <span>·</span>
                <Link
                  href={`/r/${header.ghOwner}/${header.ghRepo}/snapshots`}
                  className="text-fg underline-offset-4 hover:underline"
                >
                  Snapshot ledger
                </Link>
                <span>·</span>
                <Link
                  href={`/r/${header.ghOwner}/${header.ghRepo}/payouts`}
                  className="text-fg underline-offset-4 hover:underline"
                >
                  Payout history
                </Link>
                <span>·</span>
                <Link
                  href={`/r/${header.ghOwner}/${header.ghRepo}/token`}
                  className="text-fg underline-offset-4 hover:underline"
                >
                  Token detail
                </Link>
              </CardContent>
            </Card>
          </article>
        </div>
      </div>
    </ProjectShell>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-3 scroll-mt-6">
      <h2 className="text-headline-md text-fg">{title}</h2>
      <div className="flex flex-col gap-3 text-body-md text-fg-secondary">
        {children}
      </div>
    </section>
  );
}
