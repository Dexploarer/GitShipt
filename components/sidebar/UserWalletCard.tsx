import Link from "next/link";
import { ArrowUpRight, Wallet } from "lucide-react";
import { formatAddress } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface UserWalletCardProps {
  walletAddress?: string | null;
  balanceSolLabel?: string;
}

/**
 * Wallet snapshot for the lower sidebar. Day 2 default renders the
 * "not linked" state because the public project page is anonymous —
 * the dashboard layer can pass walletAddress + balance from session
 * when it's available.
 */
export function UserWalletCard({
  walletAddress,
  balanceSolLabel,
}: UserWalletCardProps = {}) {
  if (!walletAddress) {
    return (
      <Card depth="raised" padding="sm">
        <div className="flex items-center gap-2 text-label-sm text-fg-muted">
          <Wallet className="size-3.5" />
          Wallet
        </div>
        <Button asChild variant="secondary" size="sm" className="mt-3 w-full">
          <Link href="/auth/signin">Sign in to link</Link>
        </Button>
      </Card>
    );
  }

  return (
    <Card depth="raised" padding="sm">
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
    </Card>
  );
}
