import Link from "next/link";
import { ArrowUpRight, Vault, Wallet } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/page-guards";
import { Card, CardHeader, CardTitle, CardDescription } from "@repo/ui";
import { StatTile } from "@/components/shared/StatTile";
import { hasCredentials, serverEnv, clientEnv } from "@/lib/env";
import { hasSolanaConnection, solanaConnection } from "@/lib/solana/connection";
import { payoutSignerPublicKey } from "@/lib/solana/signer";
import { formatAddress } from "@repo/lib";
import { clusterLabel, solscanAddressUrl } from "@/lib/solana/explorer";

export const dynamic = "force-dynamic";

export default async function AdminTreasuryPage() {
  await requireAdminPage("platform.treasury.read", "/admin/treasury");

  const env = serverEnv();
  const cluster = clientEnv().NEXT_PUBLIC_SOLANA_CLUSTER;
  const hotPubkey = payoutSignerPublicKey();
  const coldAddress = env.SOLANA_TREASURY_ADDRESS ?? null;

  const hotSol =
    hotPubkey && hasSolanaConnection() ? await fetchHotSol(hotPubkey) : null;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-headline-md">Treasury</h1>
        <p className="text-body-sm text-fg-secondary">
          Read-only balances and explorer links.
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
          value={clusterLabel(cluster)}
          sub={hasCredentials.solana() ? "Helius" : "devnet fallback"}
          icon={ArrowUpRight}
        />
      </section>

      <Card depth="raised" padding="default">
        <CardHeader>
          <CardTitle>Hot wallet</CardTitle>
          <CardDescription>Signer pubkey and Solscan link.</CardDescription>
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
                  href={solscanAddressUrl(hotPubkey, cluster)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-label-sm text-primary-readable hover:underline"
                >
                  Open in Solscan ↗
                </Link>
              ) : (
                <span className="text-fg-muted">—</span>
              )}
            </span>
          </li>
        </ul>
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
                  href={solscanAddressUrl(coldAddress, cluster)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-label-sm text-primary-readable hover:underline"
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
