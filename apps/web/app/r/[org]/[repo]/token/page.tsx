import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Coins, Sparkles } from "lucide-react";
import { getProjectPageData } from "@/lib/queries/project-page";
import { getTokenStats } from "@/lib/queries/token-stats";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui";
import { Badge } from "@repo/ui";
import { Button } from "@repo/ui";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { TokenInfoCard } from "../_components/TokenInfoCard";
import { CopyButton } from "@/components/shared";
import { formatSol, formatAddress } from "@repo/lib";

type Params = Promise<{ org: string; repo: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { org, repo } = await params;
  const data = await getProjectPageData(org, repo);
  if (!data) return { title: `${org}/${repo} · Token` };
  const symbol = data.header.tokenMint
    ? data.header.ghRepo.toUpperCase().slice(0, 8)
    : null;
  return {
    title: `${data.header.name}${symbol ? ` · $${symbol}` : ""} · Token`,
    description: `Token detail page for ${data.header.slug} on Bags.fm.`,
  };
}

export default async function ProjectTokenPage({ params }: { params: Params }) {
  const { org, repo } = await params;
  const data = await getProjectPageData(org, repo);
  if (!data) notFound();

  const { header } = data;
  const stats = await getTokenStats(header);
  const platformFeePct = (header.platformFeeBps / 100).toFixed(1);
  const contributorPoolPct = ((10_000 - header.platformFeeBps) / 100).toFixed(
    1,
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <Breadcrumbs
          items={[
            { label: "Projects", href: "/explore" },
            {
              label: header.name,
              href: `/r/${header.ghOwner}/${header.ghRepo}`,
            },
            { label: "Token" },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-headline-lg leading-tight text-fg">Token</h1>
          {stats ? (
            <Badge variant="primary" size="sm">
              ${stats.symbol}
            </Badge>
          ) : null}
        </div>
        <p className="text-body-md text-fg-secondary">
          On-chain token tied to this repository. Trading fees flow to the
          platform pool wallet and are redistributed to top contributors daily.
        </p>
      </header>

      {!header.tokenMint || !stats ? (
        <Card depth="raised" padding="default" className="text-center">
          <Coins className="mx-auto size-10 text-fg-muted" aria-hidden />
          <CardTitle className="mt-3 justify-center">
            No token launched
          </CardTitle>
          <CardDescription className="mt-1 mx-auto max-w-md">
            {header.ghOwner}/{header.ghRepo} hasn&apos;t been minted on Bags.fm
            yet. The owner can launch from the dashboard to start the daily fee
            pool.
          </CardDescription>
          <Button asChild variant="primary" size="default" className="mt-4">
            <Link href="/launch">Launch a token</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex flex-col gap-4 min-w-0">
            {/* Fee structure */}
            <Card depth="raised" padding="default">
              <CardHeader>
                <CardTitle>Fee structure</CardTitle>
                <CardDescription>
                  How trading fees split between the platform and contributors.
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <FeeStat
                  label="Platform fee"
                  value={`${platformFeePct}%`}
                  sub={`${header.platformFeeBps} bps`}
                />
                <FeeStat
                  label="Contributor pool"
                  value={`${contributorPoolPct}%`}
                  sub={`${10_000 - header.platformFeeBps} bps`}
                  accent
                />
                <FeeStat
                  label="Top-N"
                  value={String(header.payoutConfig.topN)}
                  sub="contributors paid"
                />
                <FeeStat
                  label="Min payout"
                  value={formatSol(
                    BigInt(header.payoutConfig.claimThresholdLamports),
                    2,
                  )}
                  sub="threshold"
                />
              </CardContent>
            </Card>

            {/* Tier weights */}
            <Card depth="raised" padding="default">
              <CardHeader>
                <CardTitle>Tier weights</CardTitle>
                <CardDescription>
                  Share of each cycle&apos;s contributor pool by leaderboard
                  rank.
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {header.payoutConfig.tierWeights.map((w, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5"
                    >
                      <div className="text-caption text-fg-muted">
                        Rank {i + 1}
                      </div>
                      <div className="mt-1 text-mono-md text-fg">
                        {(w * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Bags integration */}
            <Card depth="raised" padding="default">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Bags.fm integration</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link
                    href={`https://bags.fm/token/${header.tokenMint}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    View on Bags.fm <ArrowUpRight className="size-3.5" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="mt-4 flex flex-col gap-2">
                <Row label="Token mint">
                  <span
                    className="text-mono-sm text-fg"
                    title={header.tokenMint}
                  >
                    {formatAddress(header.tokenMint, 6, 6)}
                  </span>
                  <CopyButton
                    value={header.tokenMint}
                    label="Copy contract address"
                  />
                  <Link
                    href={`https://solscan.io/token/${header.tokenMint}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label="View on Solscan"
                    className="inline-flex size-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-elevated hover:text-fg"
                  >
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </Row>
                {header.bagsLaunchId ? (
                  <Row label="Launch ID">
                    <span
                      className="text-mono-sm text-fg-secondary"
                      title={header.bagsLaunchId}
                    >
                      {formatAddress(header.bagsLaunchId, 8, 4)}
                    </span>
                  </Row>
                ) : null}
                <Row label="Cluster">
                  <Badge variant="warning" size="sm">
                    devnet
                  </Badge>
                </Row>
                <Row label="Lifetime fees">
                  <span className="text-mono-md text-fg">
                    {formatSol(stats.lifetimeFeesLamports, 4)}
                  </span>
                </Row>
              </CardContent>
            </Card>
          </div>

          {/* Right: TokenInfoCard preview (the embed widget) */}
          <aside className="flex flex-col gap-3 min-w-0">
            <div className="text-label-sm text-fg-muted">
              <Sparkles className="mr-1 inline size-3.5" /> Embed preview
            </div>
            <TokenInfoCard
              stats={stats}
              ghOwner={header.ghOwner}
              ghRepo={header.ghRepo}
            />
            <p className="text-caption text-fg-muted">
              This is the widget anyone can embed via{" "}
              <Link
                href={`/embed/r/${header.ghOwner}/${header.ghRepo}`}
                className="text-fg-secondary underline-offset-4 hover:text-fg hover:underline"
              >
                /embed/r/{header.ghOwner}/{header.ghRepo}
              </Link>
              . Use the <strong>Share</strong> menu on the leaderboard page to
              copy the iframe snippet.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}

function FeeStat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface/40 px-4 py-3">
      <div className="text-caption text-fg-muted">{label}</div>
      <div
        className={`mt-1 text-mono-md ${accent ? "text-primary" : "text-fg"}`}
        style={{ fontSize: "20px", letterSpacing: "-0.01em" }}
      >
        {value}
      </div>
      <div className="text-caption text-fg-muted">{sub}</div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-surface-elevated/40 px-3 py-2">
      <span className="text-body-sm text-fg-secondary">{label}</span>
      <div className="flex min-w-0 items-center gap-1.5">{children}</div>
    </div>
  );
}
