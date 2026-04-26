import Link from "next/link";
import { Coins, ExternalLink, Sparkles } from "lucide-react";
import { hasCredentials } from "@/lib/env";
import { getProjectPayoutHistory } from "@/lib/queries/dashboard";
import { formatSol, formatRelativeTime, formatAddress } from "@/lib/format";
import { loadProjectFor } from "../../../_components/loadProject";
import { AppShell } from "../../../_components/AppShell";
import { OwnedProjectSidebar } from "@/components/sidebar/OwnedProjectSidebar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { RetryPayoutButton } from "./_components/RetryPayoutButton";

export const dynamic = "force-dynamic";

export default async function PayoutsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!hasCredentials.db()) return <Stub />;
  const { id } = await params;
  const ctx = await loadProjectFor(id, "payouts.read");
  const { project } = ctx;
  const rows = await getProjectPayoutHistory(id, 50);

  return (
    <AppShell
      sidebar={
        <OwnedProjectSidebar
          projectId={id}
          slug={project.slug}
          projectName={project.name}
          active="payouts"
        />
      }
      footerLeft={`${project.slug} · devnet · BAGS.fm`}
    >
      <div className="mx-auto flex w-full max-w-content flex-col gap-4">
        <header>
          <h1 className="text-headline-lg leading-tight text-fg">Payouts</h1>
          <p className="text-body-md text-fg-secondary">
            Daily distribution history. Failed payouts can be re-queued for the
            next cron pass.
          </p>
        </header>

        <Card depth="flat" padding="none">
          <CardHeader className="border-b border-border px-6 py-4">
            <CardTitle>{rows.length} payout{rows.length === 1 ? "" : "s"}</CardTitle>
            <CardDescription>
              Sorted newest first. Click the tx signature to verify on Solscan.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Coins}
                  title="No payouts yet"
                  description="The first payout will execute right after the first daily snapshot."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-border bg-surface-elevated/40 text-label-sm text-fg-muted">
                      <th className="px-6 py-2 text-left font-medium">When</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                      <th className="px-4 py-2 text-right font-medium">Total</th>
                      <th className="px-4 py-2 text-right font-medium">Recipients</th>
                      <th className="px-4 py-2 text-left font-medium">Tx</th>
                      <th className="px-6 py-2 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r) => (
                      <tr
                        key={r.id}
                        className="text-body-md transition-colors hover:bg-surface-elevated/40"
                      >
                        <td className="px-6 py-3">
                          <div className="text-fg">
                            {r.executedAt
                              ? formatRelativeTime(r.executedAt)
                              : "—"}
                          </div>
                          <div className="text-caption text-fg-muted">
                            attempt {r.attemptCount}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <PayoutStatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3 text-right text-mono-md text-primary">
                          {formatSol(r.totalLamports, 4)}
                        </td>
                        <td className="px-4 py-3 text-right text-mono-md text-fg">
                          {r.recipientCount}
                        </td>
                        <td className="px-4 py-3">
                          {r.claimSignature ? (
                            <Link
                              href={`https://solscan.io/tx/${r.claimSignature}?cluster=devnet`}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center gap-1 text-mono-sm text-primary hover:underline"
                            >
                              {formatAddress(r.claimSignature, 6, 6)}
                              <ExternalLink className="size-3" />
                            </Link>
                          ) : (
                            <span className="text-mono-sm text-fg-muted">
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {r.status === "failed" ? (
                            <RetryPayoutButton
                              projectId={id}
                              payoutId={r.id}
                            />
                          ) : (
                            <span className="text-caption text-fg-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function PayoutStatusBadge({
  status,
}: {
  status:
    | "pending"
    | "claiming"
    | "distributing"
    | "completed"
    | "failed"
    | "cancelled";
}) {
  const map = {
    pending: { variant: "default" as const, label: "Pending" },
    claiming: { variant: "info" as const, label: "Claiming" },
    distributing: { variant: "info" as const, label: "Distributing" },
    completed: { variant: "success" as const, label: "Completed" },
    failed: { variant: "danger" as const, label: "Failed" },
    cancelled: { variant: "warning" as const, label: "Cancelled" },
  } as const;
  const v = map[status];
  return (
    <Badge variant={v.variant} size="sm" dot={status === "completed"}>
      {v.label}
    </Badge>
  );
}

function Stub() {
  return (
    <AppShell
      sidebar={
        <OwnedProjectSidebar
          projectId=""
          slug="—/—"
          projectName="—"
          active="payouts"
        />
      }
    >
      <div className="mx-auto w-full max-w-content">
        <EmptyState
          icon={Sparkles}
          title="Stub mode"
          description="Set DATABASE_URL to view payouts."
        />
      </div>
    </AppShell>
  );
}
