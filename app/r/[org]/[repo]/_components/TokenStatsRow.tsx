import Link from "next/link";
import { ArrowUpRight, Coins, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAddress, formatSol } from "@/lib/format";
import { CopyButton } from "./CopyButton";
import { EmbedCopyButton } from "./EmbedCopyButton";
import type { TokenStats } from "@/lib/queries/token-stats";

/**
 * Inline token stats — replaces the QuickStat grid that used to sit under
 * the description. Same data shape as the embed widget (TokenInfoCard) but
 * laid out as a horizontal stat strip without a card wrapper, so it reads
 * as continuation of the header rather than a separate module.
 *
 * When no token has been launched, renders a compact CTA row instead.
 */
export function TokenStatsRow({
  stats,
  ghOwner,
  ghRepo,
}: {
  stats: TokenStats | null;
  ghOwner: string;
  ghRepo: string;
}) {
  if (!stats) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5">
        <div className="text-body-sm text-fg-secondary">
          No token launched —{" "}
          <Link
            href="/launch"
            className="font-medium text-primary hover:underline"
          >
            launch one
          </Link>{" "}
          to start the daily fee pool.
        </div>
        <EmbedCopyButton ghOwner={ghOwner} ghRepo={ghRepo} />
      </div>
    );
  }

  const isUp = stats.priceChange24hPct >= 0;
  const TrendIcon = isUp ? TrendingUp : TrendingDown;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-caption uppercase tracking-wider text-fg-muted">
          <Coins className="size-3.5" />
          Token
          <span className="rounded-md border border-border/60 px-1.5 py-px text-mono-sm font-normal normal-case tracking-normal text-fg-secondary">
            {stats.symbol}
          </span>
          {stats.isStub ? (
            <span className="rounded-md border border-border/60 px-1.5 py-px text-mono-sm font-normal normal-case tracking-normal text-fg-muted">
              stub
            </span>
          ) : null}
        </div>
        <EmbedCopyButton ghOwner={ghOwner} ghRepo={ghRepo} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Price">
          <span className="text-mono-md text-fg">
            ${stats.priceUsd.toFixed(stats.priceUsd < 0.01 ? 6 : 4)}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-label-sm",
              isUp ? "text-success" : "text-danger",
            )}
          >
            <TrendIcon className="size-3" />
            {isUp ? "+" : ""}
            {stats.priceChange24hPct.toFixed(1)}%
          </span>
        </Stat>

        <Stat label="Market Cap">
          <span className="text-mono-md text-fg">
            {formatUsdCompact(stats.marketCapUsd)}
          </span>
        </Stat>

        <Stat label="24h Volume">
          <span className="text-mono-md text-fg">
            {formatUsdCompact(stats.volume24hUsd)}
          </span>
        </Stat>

        <Stat label="Holders">
          <span className="text-mono-md text-fg">
            {stats.holders.toLocaleString("en-US")}
          </span>
        </Stat>

        <Stat label="Contract">
          <span
            className="truncate text-mono-md text-fg"
            title={stats.tokenMint}
          >
            {formatAddress(stats.tokenMint, 4, 4)}
          </span>
          <div className="-mr-1 flex items-center gap-0.5">
            <CopyButton value={stats.tokenMint} label="Copy contract address" />
            <Link
              href={`https://solscan.io/token/${stats.tokenMint}?cluster=devnet`}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="View on Solscan"
              className="inline-flex size-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-elevated hover:text-fg"
            >
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </Stat>
      </div>
    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface/40 px-3 py-2 lg:px-4 lg:py-2.5">
      <div className="text-caption text-fg-muted lg:text-label-sm">{label}</div>
      <div className="mt-1 flex min-w-0 items-center justify-between gap-1.5 lg:mt-1.5">
        {children}
      </div>
    </div>
  );
}

function formatUsdCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

// Keep formatSol importable for callers; not used inline but tree-shakes.
export const _formatSol = formatSol;
