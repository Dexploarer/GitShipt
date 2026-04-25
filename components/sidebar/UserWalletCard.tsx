import Link from "next/link";
import { ArrowUpRight, Wallet } from "lucide-react";
import { formatAddress } from "@/lib/format";

/**
 * Wallet snapshot for the lower sidebar. Day 2 always renders the
 * "not linked" state because the public project page is anonymous —
 * the dashboard layer will pass the linked wallet from session in
 * a future phase. Keeping the API surface stable now (props-less)
 * means we won't refactor consumers when session wiring lands.
 */
export function UserWalletCard({
  walletAddress,
  balanceSolLabel,
}: {
  walletAddress?: string | null;
  balanceSolLabel?: string;
} = {}) {
  if (!walletAddress) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-2 text-label-sm text-fg-muted">
          <Wallet className="size-3.5" />
          Wallet
        </div>
        <Link
          href="/auth/signin"
          className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-label-md text-fg transition-colors hover:bg-surface-overlay"
        >
          Sign in to link
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="text-label-sm text-fg-muted">Wallet</div>
        <a
          href={`https://solscan.io/account/${walletAddress}?cluster=devnet`}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Open on Solscan"
          className="text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowUpRight className="size-3.5" />
        </a>
      </div>
      <div className="mt-2 text-mono-md text-fg">
        {formatAddress(walletAddress)}
      </div>
      {balanceSolLabel ? (
        <div className="mt-1 text-mono-sm text-fg-muted">
          {balanceSolLabel}
        </div>
      ) : null}
    </div>
  );
}
