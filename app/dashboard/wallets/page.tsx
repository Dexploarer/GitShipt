import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Plus, Sparkles, Wallet } from "lucide-react";
import { auth } from "@/lib/auth";
import { hasCredentials } from "@/lib/env";
import { getMyLinkedWallets } from "@/lib/queries/dashboard";
import { formatAddress, formatRelativeTime } from "@/lib/format";
import { AppShell } from "../_components/AppShell";
import { AuthSidebar } from "@/components/sidebar/AuthSidebar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { CopyButton } from "@/app/r/[org]/[repo]/_components/CopyButton";

export const dynamic = "force-dynamic";

export default async function WalletsPage() {
  if (!hasCredentials.db()) {
    return (
      <AppShell sidebar={<AuthSidebar
          active="wallets" />}>
        <div className="mx-auto w-full max-w-content">
          <EmptyState
            icon={Sparkles}
            title="Stub mode"
            description="Set DATABASE_URL to view linked wallets."
          />
        </div>
      </AppShell>
    );
  }

  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/auth/signin?next=/dashboard/wallets");
  const wallets = await getMyLinkedWallets(session.user.id);

  return (
    <AppShell
      sidebar={
        <AuthSidebar
          active="wallets"
          user={{
            name: session.user.name ?? null,
            email: session.user.email ?? null,
            username:
              (session.user as { githubUsername?: string | null }).githubUsername ??
              null,
            imageUrl: session.user.image ?? null,
          }}
        />
      }
      footerLeft={`${session.user.name ?? session.user.email} · devnet · BAGS.fm`}
    >
      <div className="mx-auto flex w-full max-w-content flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-headline-lg leading-tight text-fg">Wallets</h1>
            <p className="text-body-md text-fg-secondary">
              Solana wallets you've linked via Sign-In With Solana.
            </p>
          </div>
          <Button asChild variant="primary">
            <Link href="/auth/wallet">
              <Plus className="size-4" /> Link a wallet
            </Link>
          </Button>
        </header>

        <Card depth="flat" padding="none">
          <CardHeader className="border-b border-border px-6 py-4">
            <CardTitle>
              {wallets.length} linked wallet{wallets.length === 1 ? "" : "s"}
            </CardTitle>
            <CardDescription>
              Your primary wallet receives payouts by default.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {wallets.length === 0 ? (
              <div className="px-6 py-10">
                <EmptyState
                  icon={Wallet}
                  title="No wallets linked"
                  description="Link a Solana wallet to start receiving on-chain payouts directly — no escrow."
                  cta={{ label: "Link a wallet", href: "/auth/wallet" }}
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {wallets.map((w) => (
                  <li
                    key={w.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 px-6 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-mono-md text-fg">
                          {formatAddress(w.address, 6, 6)}
                        </span>
                        <CopyButton value={w.address} label="Copy address" />
                        <Link
                          href={`https://solscan.io/account/${w.address}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-fg-muted hover:text-fg"
                          aria-label="Solscan"
                        >
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </div>
                      {w.label ? (
                        <div className="text-caption text-fg-muted">
                          {w.label}
                        </div>
                      ) : null}
                    </div>
                    <Badge variant="default" size="sm">
                      {w.chain}
                    </Badge>
                    {w.isPrimary ? (
                      <Badge variant="primary" size="sm">
                        primary
                      </Badge>
                    ) : (
                      <span className="text-caption text-fg-muted">—</span>
                    )}
                    <span className="text-caption text-fg-muted">
                      verified {formatRelativeTime(w.verifiedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
