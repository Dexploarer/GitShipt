import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Coins,
  ExternalLink,
  Github,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { hasCredentials } from "@/lib/env";
import {
  getProjectKPIs,
  getRecentProjectAudit,
  getFailedPayoutsForProject,
  getIndexerState,
  type RecentAuditEntry,
  type FailedPayoutAlert,
  type IndexerState,
} from "@/lib/queries/dashboard";
import { formatSol, formatRelativeTime } from "@/lib/format";
import { loadProjectFor } from "../../_components/loadProject";
import { StatTile } from "@/components/shared/StatTile";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { StatusBadge } from "../../page";

export const dynamic = "force-dynamic";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!hasCredentials.db()) {
    return <StubShell />;
  }
  const { id } = await params;
  const ctx = await loadProjectFor(id, "project.read");
  const { project } = ctx;

  const [kpis, audit, failed, indexer] = await Promise.all([
    getProjectKPIs(id),
    getRecentProjectAudit(id, 10),
    getFailedPayoutsForProject(id, 5),
    getIndexerState(id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Projects", href: "/dashboard" },
              { label: project.name },
            ]}
            className="mb-1"
          />
          <div className="flex items-center gap-2">
            <h1 className="truncate text-headline-lg leading-tight text-fg">
              {project.name}
            </h1>
            <StatusBadge status={project.status} />
          </div>
          <div className="mt-1 flex items-center gap-3 text-mono-sm text-fg-secondary">
            <Link
              href={`https://github.com/${project.slug}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 hover:text-fg"
            >
              <Github className="size-3.5" /> {project.slug}
            </Link>
            <span className="text-fg-muted">·</span>
            <span>created {formatRelativeTime(project.createdAt)}</span>
          </div>
        </div>
        <Button asChild variant="secondary" size="default">
          <Link
            href={`/r/${project.slug}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            View public page <ExternalLink className="size-4" />
          </Link>
        </Button>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Contributors Ranked"
          value={kpis.totalContributorsRanked.toString()}
          icon={Users}
        />
        <StatTile
          label="Payouts Executed"
          value={kpis.totalPayoutsExecuted.toString()}
          icon={Trophy}
        />
        <StatTile
          label="Lifetime Fees"
          value={formatSol(kpis.lifetimeFeesLamports, 4)}
          icon={Coins}
          accent="primary"
        />
        <StatTile
          label="Pending Escrow"
          value={formatSol(kpis.pendingEscrowLamports, 4)}
          icon={Sparkles}
          sub={
            kpis.lastSnapshotAt
              ? `last snapshot ${formatRelativeTime(kpis.lastSnapshotAt)}`
              : "no snapshots yet"
          }
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <RecentActivityCard rows={audit} />
        <AlertsCard failed={failed} indexer={indexer} projectId={id} />
      </div>
    </div>
  );
}

function RecentActivityCard({ rows }: { rows: RecentAuditEntry[] }) {
  return (
    <Card depth="flat" padding="none">
      <CardHeader className="border-b border-border px-6 py-4">
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>
          Last 10 admin actions on this project.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-body-md text-fg-secondary">
            No audit events yet — actions you take here will appear in real
            time.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-start gap-3 px-6 py-3 text-body-md"
              >
                <Activity
                  className="mt-0.5 size-4 shrink-0 text-fg-muted"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-label-md text-fg">
                      {humanizeAction(r.action)}
                    </span>
                    <span className="text-caption text-fg-muted">
                      {formatRelativeTime(r.createdAt)}
                    </span>
                  </div>
                  <div className="text-caption text-fg-muted truncate">
                    {r.actorName ?? "system"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AlertsCard({
  failed,
  indexer,
  projectId,
}: {
  failed: FailedPayoutAlert[];
  indexer: IndexerState | null;
  projectId: string;
}) {
  const indexerStale = indexer?.isStale ?? false;
  const hasAlerts = failed.length > 0 || indexerStale;
  return (
    <Card depth="flat" padding="none">
      <CardHeader className="border-b border-border px-6 py-4">
        <CardTitle>Alerts</CardTitle>
        <CardDescription>
          Things that need your attention right now.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {!hasAlerts ? (
          <div className="px-6 py-10 text-center">
            <Badge variant="success" dot size="sm">
              All clear
            </Badge>
            <p className="mt-2 text-body-sm text-fg-secondary">
              No failed payouts. Indexer is fresh.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {failed.map((f) => (
              <li key={f.id} className="px-6 py-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-danger" aria-hidden />
                  <span className="text-label-md text-fg">Payout failed</span>
                  <Badge variant="danger" size="sm">
                    attempt {f.attemptCount}
                  </Badge>
                </div>
                {f.lastError ? (
                  <p className="mt-1 text-caption text-fg-muted truncate">
                    {f.lastError}
                  </p>
                ) : null}
                <Link
                  href={`/dashboard/projects/${projectId}/payouts`}
                  className="mt-1 inline-flex text-label-sm text-primary hover:underline"
                >
                  Review &amp; retry
                </Link>
              </li>
            ))}
            {indexerStale ? (
              <li className="px-6 py-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-warning" aria-hidden />
                  <span className="text-label-md text-fg">
                    Indexer is stale
                  </span>
                </div>
                <p className="mt-1 text-caption text-fg-muted">
                  {indexer?.lastIncrementalSyncAt
                    ? `Last sync ${formatRelativeTime(indexer.lastIncrementalSyncAt)}`
                    : "Never synced"}
                  . Check Repository &gt; Re-index in v1.1.
                </p>
              </li>
            ) : null}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function humanizeAction(action: string): string {
  return action
    .split(".")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" · ");
}

function StubShell() {
  return (
    <div className="mx-auto w-full max-w-content">
      <EmptyState
        icon={Sparkles}
        title="Stub mode"
        description="DATABASE_URL is not configured. Per-project console comes online when Postgres is provisioned."
      />
    </div>
  );
}
