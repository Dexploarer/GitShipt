"use client";

import { useCallback, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet, LogOut, Loader2 } from "lucide-react";
import { Button } from "@repo/ui";

/**
 * Truncate a base58 pubkey to first 4 + last 4. Mono per design tokens.
 */
function truncate(pk: string): string {
  if (pk.length <= 10) return pk;
  return `${pk.slice(0, 4)}…${pk.slice(-4)}`;
}

/**
 * Minimal Connect / Disconnect control.
 *
 * - Disconnected: opens the wallet-adapter modal so the user picks an installed
 *   standard wallet (Phantom, Backpack, Solflare, etc).
 * - Connected: shows the truncated pubkey + a disconnect action.
 *
 * Styled with our Button primitive so it inherits theme tokens. No raw hex.
 */
export function WalletConnectButton() {
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const label = useMemo(() => (publicKey ? truncate(publicKey.toBase58()) : null), [publicKey]);

  const onConnect = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  const onDisconnect = useCallback(() => {
    void disconnect().catch(() => {
      /* swallow; adapter surfaces errors via its own listeners */
    });
  }, [disconnect]);

  if (connected && label) {
    return (
      <div className="inline-flex items-center gap-2">
        <span
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border-strong bg-surface-elevated px-3 text-mono-sm text-fg"
          aria-label="Connected wallet address"
        >
          <Wallet className="size-4 text-fg-secondary" aria-hidden />
          {label}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="default"
          onClick={onDisconnect}
          aria-label="Disconnect wallet"
        >
          <LogOut className="size-4" aria-hidden />
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="primary"
      size="lg"
      onClick={onConnect}
      disabled={connecting}
      aria-busy={connecting}
    >
      {connecting ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Connecting…
        </>
      ) : (
        <>
          <Wallet className="size-4" aria-hidden />
          Connect wallet
        </>
      )}
    </Button>
  );
}
