import Link from "next/link";
import { Sparkles, Wallet } from "lucide-react";

export const metadata = { title: "Link wallet" };

/**
 * SIWS link page. Day 1: explains the flow + shows the verify API targets.
 * Day 2 wires in actual wallet adapter integration (Phantom/Backpack) and
 * runs the verify POST end-to-end.
 */
export default function WalletAuthPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-popover">
        <Link href="/" className="mb-6 inline-flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-bg">
            <Sparkles className="size-4" />
          </span>
          <span className="text-headline-sm tracking-tight">GitBags</span>
        </Link>

        <h1 className="text-headline-md">Link a Solana wallet</h1>
        <p className="mt-2 text-body-md text-fg-secondary">
          Sign a Sign-In-With-Solana (SIWS) message to prove ownership of your
          wallet. We use this to route payouts and to claim earnings from
          escrow.
        </p>

        <div className="mt-8 space-y-3 rounded-md border border-border-strong bg-surface-elevated p-4">
          <div className="text-label-sm text-fg-muted">API endpoints</div>
          <div className="text-mono-sm">
            POST /api/wallets/nonce <span className="text-fg-muted">→ issues 5-min nonce</span>
          </div>
          <div className="text-mono-sm">
            POST /api/wallets/verify <span className="text-fg-muted">→ verifies signature, links wallet</span>
          </div>
        </div>

        <p className="mt-6 text-body-sm text-fg-muted">
          The wallet adapter UI ships Day 2. Until then, you can curl the
          endpoints directly with a signed SIWS message.
        </p>
      </div>
    </div>
  );
}
