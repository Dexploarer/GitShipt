import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { Coins, Sparkles, Wallet } from "lucide-react";
import { auth } from "@/lib/auth";
import { hasCredentials } from "@/lib/env";
import { getMyEarnings, getMyLinkedWallets } from "@/lib/queries/dashboard";
import { dbHttp } from "@/db";
import { projects } from "@/db/schema";
import { formatSol } from "@/lib/format";
import { AppShell } from "../_components/AppShell";
import { DashboardSidebar } from "@/components/sidebar/DashboardSidebar";
import { StatTile } from "@/components/shared/StatTile";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClaimEscrowButton } from "./_components/ClaimEscrowButton";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

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

  const [earnings, linkedWallets] = await Promise.all([
    getMyEarnings(session.user.id),
    getMyLinkedWallets(session.user.id),
  ]);
  const walletLinked = linkedWallets.length > 0;

  // Resolve projectId per slug so the per-row Claim button can pass it to
  // the API (the earnings query returns slugs only).
  const slugs = earnings.byProject.map((p) => p.projectSlug);
  const projectIdBySlug = new Map<string, string>();
  if (slugs.length > 0) {
    const slugLiterals = sql.join(
      slugs.map((s) => sql`${s}`),
      sql`, `,
    );
    const rows = await dbHttp
      .select({
        id: projects.id,
        slug: sql<string>`${projects.ghOwner} || '/' || ${projects.ghRepo}`,
      })
      .from(projects)
      .where(sql`(${projects.ghOwner} || '/' || ${projects.ghRepo}) in (${slugLiterals})`);
    for (const r of rows) projectIdBySlug.set(r.slug, r.id);
  }

  return (
    <AppShell
      sidebar={<DashboardSidebar active="earnings" />}
      footerLeft={`${session.user.name ?? session.user.email} · devnet · BAGS.fm`}
    >
      <div className="mx-auto flex w-full max-w-content flex-col gap-4">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Earnings" },
          ]}
        />
        <header>
          <h1 className="text-headline-lg leading-tight text-fg">Earnings</h1>
          <p className="text-body-md text-fg-secondary">
            Your lifetime SOL earnings across every project you've contributed
            to.
          </p>
        </header>

        {!walletLinked ? (
          <Card depth="raised" padding="default">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-col gap-1">
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="size-4 text-primary" />
                  Link a Solana wallet to claim earnings
                </CardTitle>
                <CardDescription>
                  Escrow holdings drain to your linked wallet on click.
                </CardDescription>
              </div>
              <Button variant="primary" size="sm" asChild>
                <Link href="/auth/wallet">Link wallet →</Link>
              </Button>
            </div>
          </Card>
        ) : null}

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
            sub={
              walletLinked
                ? "Claim per project below"
                : "Link a wallet to claim"
            }
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
                    <th className="px-4 py-2 text-right font-medium">Escrow</th>
                    <th className="px-6 py-2 text-right font-medium">Claim</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {earnings.byProject.map((p) => {
                    const projectId = projectIdBySlug.get(p.projectSlug);
                    return (
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
                        <td className="px-4 py-3 text-right text-mono-md text-fg">
                          {formatSol(p.escrowLamports, 4)}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {projectId ? (
                            <ClaimEscrowButton
                              projectId={projectId}
                              projectSlug={p.projectSlug}
                              escrowLamports={p.escrowLamports}
                              walletLinked={walletLinked}
                            />
                          ) : (
                            <span className="text-label-sm text-fg-muted">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
