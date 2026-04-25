import Link from "next/link";
import { CheckCircle2, ExternalLink, Github, RefreshCw, Sparkles, XCircle } from "lucide-react";
import { hasCredentials } from "@/lib/env";
import { getIndexerState } from "@/lib/queries/dashboard";
import { formatRelativeTime } from "@/lib/format";
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
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/EmptyState";

export const dynamic = "force-dynamic";

export default async function RepositoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!hasCredentials.db()) return <Stub />;
  const { id } = await params;
  const ctx = await loadProjectFor(id, "project.read");
  const { project } = ctx;
  const indexer = await getIndexerState(id);

  return (
    <AppShell
      sidebar={
        <OwnedProjectSidebar
          projectId={id}
          slug={project.slug}
          projectName={project.name}
          active="repository"
        />
      }
      footerLeft={`${project.slug} · devnet · BAGS.fm`}
    >
      <div className="mx-auto flex w-full max-w-content flex-col gap-4">
        <header>
          <h1 className="text-headline-lg leading-tight text-fg">Repository</h1>
          <p className="text-body-md text-fg-secondary">
            GitHub install state, indexer cursors, and re-sync controls.
          </p>
        </header>

        <Card depth="flat" padding="none">
          <CardHeader className="border-b border-border px-6 py-4">
            <CardTitle>GitHub link</CardTitle>
            <CardDescription>
              The repo whose activity feeds this project's leaderboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-6 py-5">
            <Row label="Slug">
              <Link
                href={`https://github.com/${project.slug}`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-mono-md text-primary hover:underline"
              >
                <Github className="size-3.5" /> {project.slug}
                <ExternalLink className="size-3" />
              </Link>
            </Row>
            <Row label="Installation">
              {project.ghInstallationId ? (
                <Badge variant="success" size="sm" dot>
                  <CheckCircle2 className="size-3" /> Installed (
                  {project.ghInstallationId})
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  <XCircle className="size-3" /> Not installed
                </Badge>
              )}
            </Row>
          </CardContent>
        </Card>

        <Card depth="flat" padding="none">
          <CardHeader className="border-b border-border px-6 py-4">
            <CardTitle>Indexer state</CardTitle>
            <CardDescription>
              GitBags pulls events every 15 minutes via the GitHub App.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-6 py-5">
            <Row label="Last full sync">
              <span className="text-mono-sm text-fg">
                {indexer?.lastFullSyncAt
                  ? formatRelativeTime(indexer.lastFullSyncAt)
                  : "never"}
              </span>
            </Row>
            <Row label="Last incremental sync">
              <div className="flex items-center gap-2">
                <span className="text-mono-sm text-fg">
                  {indexer?.lastIncrementalSyncAt
                    ? formatRelativeTime(indexer.lastIncrementalSyncAt)
                    : "never"}
                </span>
                {indexer?.isStale ? (
                  <Badge variant="warning" size="sm">stale</Badge>
                ) : indexer?.lastIncrementalSyncAt ? (
                  <Badge variant="success" size="sm">fresh</Badge>
                ) : null}
              </div>
            </Row>
            {indexer?.lastError ? (
              <Row label="Last error">
                <span className="text-mono-sm text-danger truncate">
                  {indexer.lastError}
                </span>
              </Row>
            ) : null}
            <div className="border-t border-border pt-3">
              <Button variant="secondary" disabled title="Coming v1.1">
                <RefreshCw className="size-4" /> Re-index now
              </Button>
              <p className="mt-1 text-caption text-fg-muted">
                Manual re-index ships in v1.1. The 15-minute cron handles
                routine catch-up.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-label-sm text-fg-secondary">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
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
          active="repository"
        />
      }
    >
      <div className="mx-auto w-full max-w-content">
        <EmptyState
          icon={Sparkles}
          title="Stub mode"
          description="Set DATABASE_URL to view repository state."
        />
      </div>
    </AppShell>
  );
}
