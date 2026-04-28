import { TrendingUp } from "lucide-react";
import { formatSol } from "@repo/lib";
import { Card } from "@repo/ui";
import { Badge } from "@repo/ui";
import type {
  ProjectHeader,
  PoolOverview,
} from "@/lib/queries/project-page";

export interface TokenSparkCardProps {
  header: ProjectHeader;
  pool: PoolOverview;
}

/**
 * Lower-sidebar token snapshot. Day 2 placeholder: when no token has been
 * launched we show a muted "No token launched" state. When a mint exists,
 * we render a stub price/volume row built from the project's lifetime pool
 * value — real DEX feed lands Day 3.
 *
 * The +12.4% delta and 24H Vol are deterministic stubs (do NOT use Math.random
 * here — server/client mismatch and unstable test snapshots).
 */
export function TokenSparkCard({ header, pool }: TokenSparkCardProps) {
  if (!header.tokenMint || header.status !== "live") {
    return (
      <Card depth="raised" padding="sm">
        <div className="text-label-sm text-fg-muted">Token</div>
        <div className="mt-2 text-body-md text-fg-secondary">
          {header.status === "launch_configured"
            ? "Launch configured"
            : "No token launched"}
        </div>
        <div className="mt-1 text-caption text-fg-muted">
          {header.status === "launch_configured"
            ? "Broadcast the launch tx to start fee accrual."
            : "Launch on Bags.fm to start fee accrual."}
        </div>
      </Card>
    );
  }

  const symbol = header.ghRepo.toUpperCase().slice(0, 8);
  // Stub price: lifetime SOL / 1e9 — a stable placeholder that scales with pool.
  const stubPrice =
    Number(pool.lifetimeLamports) / 1_000_000_000 / 100_000 || 0.00001;
  const priceLabel = `$${stubPrice.toFixed(5)}`;
  const volLabel = `$${(stubPrice * 25_000_000).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;

  return (
    <Card depth="raised" padding="sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-label-sm text-fg">{symbol}</div>
          <div className="text-caption text-fg-muted">BAGS Token</div>
        </div>
        <Badge variant="success" size="sm">
          <TrendingUp className="size-3" />
          +12.4%
        </Badge>
      </div>
      <div className="mt-3 text-mono-md text-fg">{priceLabel}</div>
      <div className="mt-1 flex items-center justify-between text-caption text-fg-muted">
        <span>24H Vol</span>
        <span className="text-mono-sm">{volLabel}</span>
      </div>
      <div className="mt-2 border-t border-border pt-2 text-caption text-fg-muted">
        Lifetime{" "}
        <span className="text-mono-sm text-fg-secondary">
          {formatSol(pool.lifetimeLamports, 2)}
        </span>
      </div>
    </Card>
  );
}
