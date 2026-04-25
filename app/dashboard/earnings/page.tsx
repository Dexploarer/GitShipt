import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Coins, Sparkles, Wallet } from "lucide-react";
import { auth } from "@/lib/auth";
import { hasCredentials } from "@/lib/env";
import { getMyEarnings } from "@/lib/queries/dashboard";
import { formatSol } from "@/lib/format";
import { AppShell } from "../_components/AppShell";
import { DashboardSidebar } from "@/components/sidebar/DashboardSidebar";
import { StatTile } from "@/components/dashboard/StatTile";
import { EmptyState } from "@/components/dashboard/EmptyState";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EarningsPage() {
  if (!hasCredentials.db()) {
    return (
      <AppShell sidebar={<DashboardSidebar active="earnings" />}>
        <div className="mx-auto w-full max-w-content">
          <EmptyState
            icon={Sparkles}
            title="Stub mode"
            description="Set DATABASE_URL to view earnings."
          />
        </div>
      </AppShell>
    );
  }

  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/auth/signin?next=/dashboard/earnings");

  const earnings = await getMyEarnings(session.user.id);

  return (
    <AppShell
      sidebar={<DashboardSidebar active="earnings" />}
      footerLeft={`${session.user.name ?? session.user.email} · devnet · BAGS.fm`}
    >
      <div className="mx-auto flex w-full max-w-content flex-col gap-4">
        <header>
          <h1 className="text-headline-lg leading-tight text-fg">Earnings</h1>
          <p className="text-body-md text-fg-secondary">
            Your lifetime SOL earnings across every project you've contributed
            to.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatTile
            label="Lifetime Earned"
            value={formatSol(earnings.totalLifetimeLamports, 4)}
            icon={Coins}
            accent="primary"
          />
          <StatTile
            label="Pending in Escrow"
            value={formatSol(earnings.pendingEscrowLamports, 4)}
            icon={Sparkles}
            sub="Auto-claims on next wallet link"
          />
        </section>

        <Card depth="flat" padding="none">
          <CardHeader className="border-b border-border px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>By project</CardTitle>
                <CardDescription>
                  Lifetime + escrow split per repo.
                </CardDescription>
              </div>
              <Button variant="primary" disabled title="Auto-claim on link">
                <Wallet className="size-4" /> Claim escrow
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {earnings.byProject.length === 0 ? (
              <div className="px-6 py-10">
                <EmptyState
                  icon={Coins}
                  title="No earnings yet"
                  description="Once you've claimed your contributor rows on any project, your earnings will roll up here."
                />
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface-elevated/40 text-label-sm text-fg-muted">
                    <th className="px-6 py-2 text-left font-medium">Project</th>
                    <th className="px-4 py-2 text-right font-medium">
                      Lifetime
                    </th>
                    <th className="px-6 py-2 text-right font-medium">Escrow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {earnings.byProject.map((p) => (
                    <tr
                      key={p.projectSlug}
                      className="text-body-md transition-colors hover:bg-surface-elevated/40"
                    >
                      <td className="px-6 py-3 text-mono-sm text-fg">
                        {p.projectSlug}
                      </td>
                      <td className="px-4 py-3 text-right text-mono-md text-primary">
                        {formatSol(p.lifetimeLamports, 4)}
                      </td>
                      <td className="px-6 py-3 text-right text-mono-md text-fg">
                        {formatSol(p.escrowLamports, 4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
