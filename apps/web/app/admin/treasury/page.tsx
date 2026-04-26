import Link from "next/link";
import { ArrowUpRight, Vault, Wallet } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/page-guards";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@repo/ui";
import { Button } from "@repo/ui";
import { Badge } from "@repo/ui";
import { StatTile } from "@/components/shared/StatTile";
import { hasCredentials, serverEnv, clientEnv } from "@/lib/env";
import { hasSolanaConnection, solanaConnection } from "@/lib/solana/connection";
import { payoutSignerPublicKey } from "@/lib/solana/signer";
import { formatAddress } from "@repo/lib";

export const dynamic = "force-dynamic";

export default async function AdminTreasuryPage() {
  await requireAdminPage("platform.treasury.read", "/admin/treasury");

  const env = serverEnv();
  const cluster = clientEnv().NEXT_PUBLIC_SOLANA_CLUSTER;
  const hotPubkey = payoutSignerPublicKey();
  const coldAddress = env.SOLANA_TREASURY_ADDRESS ?? null;

  const hotSol =
    hotPubkey && hasSolanaConnection() ? await fetchHotSol(hotPubkey) : null;

  const solscanBase =
    cluster === "mainnet-beta"
      ? "https://solscan.io/account/"
      : `https://solscan.io/account/`;
  const solscanCluster =
    cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-headline-md tracking-tight">Treasury</h1>
        <p className="text-body-sm text-fg-secondary">
          Read-only. Top-ups go cold-treasury → hot-wallet under MFA (manual,
          v1.1).
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatTile
          label="Hot wallet balance"
          value={
            hotSol == null ? (
              <span className="text-fg-muted">—</span>
            ) : (
              `${hotSol.toFixed(4)} SOL`
            )
          }
          sub={hotPubkey ? formatAddress(hotPubkey) : "no signer configured"}
          icon={Wallet}
          accent={hotSol != null && hotSol < 0.5 ? "warning" : "neutral"}
        />
        <StatTile
          label="Cold treasury"
          value={
            coldAddress ? (
              formatAddress(coldAddress)
            ) : (
              <span className="text-fg-muted">unset</span>
            )
          }
          sub="MFA-gated, manual top-ups only"
          icon={Vault}
        />
        <StatTile
          label="Cluster"
          value={cluster}
          sub={hasCredentials.solana() ? "Helius" : "devnet fallback"}
          icon={ArrowUpRight}
        />
      </section>

      <Card depth="raised" padding="default">
        <CardHeader>
          <CardTitle>Hot wallet</CardTitle>
          <CardDescription>
            Signer pubkey + Solscan link. Recent transactions land here once
            Helius RPC is configured (live tx fetch v1.1; for now use Solscan).
          </CardDescription>
        </CardHeader>
        <ul className="mt-3 space-y-2 text-body-sm">
          <li className="flex items-center justify-between">
            <span className="text-fg-secondary">Pubkey</span>
            <span className="text-mono-sm text-fg">{hotPubkey ?? "—"}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-fg-secondary">Solscan</span>
            <span>
              {hotPubkey ? (
                <Link
                  href={`${solscanBase}${hotPubkey}${solscanCluster}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-label-sm text-primary hover:underline"
                >
                  Open in Solscan ↗
                </Link>
              ) : (
                <span className="text-fg-muted">—</span>
              )}
            </span>
          </li>
        </ul>
        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled
            title="Top-up flow ships in v1.1"
          >
            Top up hot wallet
          </Button>
          <Badge variant="warning" size="sm">
            v1.1
          </Badge>
        </div>
      </Card>

      <Card depth="flat" padding="default">
        <CardHeader>
          <CardTitle>Cold treasury</CardTitle>
          <CardDescription>
            Cold key never enters Vercel. Top-ups are signed offline and
            broadcast via the operator&apos;s hardware wallet.
          </CardDescription>
        </CardHeader>
        <ul className="mt-3 space-y-2 text-body-sm">
          <li className="flex items-center justify-between">
            <span className="text-fg-secondary">Address</span>
            <span className="text-mono-sm text-fg">{coldAddress ?? "—"}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-fg-secondary">Solscan</span>
            <span>
              {coldAddress ? (
                <Link
                  href={`${solscanBase}${coldAddress}${solscanCluster}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-label-sm text-primary hover:underline"
                >
                  Open in Solscan ↗
                </Link>
              ) : (
                <span className="text-fg-muted">unset</span>
              )}
            </span>
          </li>
        </ul>
      </Card>
    </div>
  );
}

async function fetchHotSol(pubkey: string): Promise<number | null> {
  if (!hasCredentials.payoutKey()) return null;
  try {
    const { PublicKey } = await import("@solana/web3.js");
    const lamports = await solanaConnection("confirmed").getBalance(
      new PublicKey(pubkey),
    );
    return lamports / 1_000_000_000;
  } catch {
    return null;
  }
}
