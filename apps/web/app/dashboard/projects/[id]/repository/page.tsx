import { Suspense } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Github,
  Sparkles,
  XCircle,
} from "lucide-react";
import { hasCredentials } from "@/lib/env";
import { getIndexerState } from "@/lib/queries/dashboard";
import { loadProjectFor } from "../../../_components/loadProject";
import { RelativeTime } from "@/components/shared/RelativeTime";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui";
import { Badge } from "@repo/ui";
import { Button } from "@repo/ui";
import { EmptyState } from "@/components/shared/EmptyState";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { ReindexButton } from "./_components/ReindexButton";


export default function RepositoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ installed?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <RepositoryPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function RepositoryPageContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ installed?: string }>;
}) {
  if (!hasCredentials.db()) return <Stub />;
  const { id } = await params;
  const { installed: installedParam } = await searchParams;
  const ctx = await loadProjectFor(id, "project.read");
  const { project } = ctx;
  const indexer = await getIndexerState(id);
  const isInstalled = Boolean(project.ghInstallationId);
  const installUrl = `/api/projects/${id}/install-github`;

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects", href: "/dashboard/projects" },
          { label: project.name, href: `/dashboard/projects/${id}` },
          { label: "Repository" },
        ]}
      />

      {installedParam === "1" ? (
        <div className="rounded-md border border-success/40 bg-success/10 px-4 py-3 text-body-sm text-fg">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="size-4 text-success" />
            GitHub App installed. The next indexer beat will pick up your
            activity — or click <strong>Re-index now</strong> below to kick it
            off immediately.
          </span>
        </div>
      ) : installedParam === "pending" ? (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-body-sm text-fg">
          Installation requested. An org admin must approve the GitHub App
          before indexing can begin.
        </div>
      ) : null}

      <Card depth="flat" padding="none">
        <CardHeader className="border-b border-border px-6 py-4">
          <CardTitle>GitHub link</CardTitle>
          <CardDescription>
            The repo whose activity feeds this project&apos;s leaderboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-6 py-5">
          <Row label="Slug">
            <Link
              href={`https://github.com/${project.slug}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-mono-md text-primary-readable hover:underline"
            >
              <Github className="size-3.5" /> {project.slug}
              <ExternalLink className="size-3" />
            </Link>
          </Row>
          <Row label="Installation">
            {isInstalled ? (
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
          <div className="border-t border-border pt-3">
            {isInstalled ? (
              <div className="flex flex-col gap-1">
                <Button asChild variant="secondary">
                  <a href={installUrl}>
                    <Github className="size-4" /> Manage GitHub App installation
                  </a>
                </Button>
                <p className="text-caption text-fg-muted">
                  Re-running the install flow lets you change which repos the
                  App can see.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <Button asChild variant="primary">
                  <a href={installUrl}>
                    <Download className="size-4" /> Install GitHub App
                  </a>
                </Button>
                <p className="text-caption text-fg-muted">
                  Required before GitShipt can index commits, PRs, and reviews
                  for this repo.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card depth="flat" padding="none">
        <CardHeader className="border-b border-border px-6 py-4">
          <CardTitle>Indexer state</CardTitle>
          <CardDescription>
            GitShipt pulls events every 15 minutes via the GitHub App.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-6 py-5">
          <Row label="Last full sync">
            <span className="text-mono-sm text-fg">
              {indexer?.lastFullSyncAt ? (
                <RelativeTime date={indexer.lastFullSyncAt} />
              ) : (
                "never"
              )}
            </span>
          </Row>
          <Row label="Last incremental sync">
            <div className="flex items-center gap-2">
              <span className="text-mono-sm text-fg">
                {indexer?.lastIncrementalSyncAt ? (
                  <RelativeTime date={indexer.lastIncrementalSyncAt} />
                ) : (
                  "never"
                )}
              </span>
              {indexer?.isStale ? (
                <Badge variant="warning" size="sm">
                  stale
                </Badge>
              ) : indexer?.lastIncrementalSyncAt ? (
                <Badge variant="success" size="sm">
                  fresh
                </Badge>
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
            <ReindexButton projectId={id} installed={isInstalled} />
          </div>
        </CardContent>
      </Card>
    </div>
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
    <div className="mx-auto w-full max-w-content">
      <EmptyState
        icon={Sparkles}
        title="Stub mode"
        description="Set DATABASE_URL or POSTGRES_URL to view repository state."
      />
    </div>
  );
}
