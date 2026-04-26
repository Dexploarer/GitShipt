import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Github,
  Power,
  RefreshCcw,
  Settings2,
  Sparkles,
} from "lucide-react";
import { requireAdminPage } from "@/lib/auth/page-guards";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@repo/ui";
import { Badge } from "@repo/ui";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { getProjectAdminDetail } from "@/lib/queries/admin";
import { formatRelativeTime } from "@repo/lib";
import { ProjectGodModeControls } from "./_components/ProjectGodModeControls";

export const dynamic = "force-dynamic";

export default async function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdminPage("admin.access", "/admin");

  const detail = await getProjectAdminDetail(id);
  if (!detail) notFound();

  const {
    project,
    ownerName,
    ownerUsername,
    scoringConfig,
    payoutConfig,
    contributorsCount,
  } = detail;
  const slug = `${project.ghOwner}/${project.ghRepo}`;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Breadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Projects", href: "/admin/projects" },
              { label: project.name },
            ]}
            className="mb-1"
          />
          <h1 className="text-headline-md tracking-tight">{project.name}</h1>
          <p className="text-mono-sm text-fg-secondary">
            {slug} · owned by {ownerUsername ?? ownerName ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={project.status} />
          <Link
            href={`https://github.com/${project.ghOwner}/${project.ghRepo}`}
            className="inline-flex items-center gap-1.5 text-label-sm text-fg-secondary hover:text-fg"
            target="_blank"
            rel="noreferrer noopener"
          >
            <Github className="size-4" /> Repo
          </Link>
        </div>
      </header>

      <Card depth="raised" padding="default" className="border-danger/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-danger" /> God-mode controls
          </CardTitle>
          <CardDescription>
            Every action here is destructive and audited. Reason ≥ 20 chars and
            typed-name confirmation required.
          </CardDescription>
        </CardHeader>
        <ProjectGodModeControls
          projectId={project.id}
          projectName={project.name}
          status={project.status}
          scoringConfigJson={JSON.stringify(scoringConfig, null, 2)}
          payoutConfigJson={JSON.stringify(payoutConfig, null, 2)}
        />
      </Card>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card depth="flat" padding="sm">
          <CardHeader className="px-1.5 pt-1">
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="size-4 text-fg-muted" /> Scoring config
            </CardTitle>
          </CardHeader>
          <pre className="mt-2 max-h-60 overflow-auto rounded-md bg-surface-elevated p-2 text-mono-sm text-fg-secondary">
            {JSON.stringify(scoringConfig, null, 2)}
          </pre>
        </Card>
        <Card depth="flat" padding="sm">
          <CardHeader className="px-1.5 pt-1">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-fg-muted" /> Payout config
            </CardTitle>
          </CardHeader>
          <pre className="mt-2 max-h-60 overflow-auto rounded-md bg-surface-elevated p-2 text-mono-sm text-fg-secondary">
            {JSON.stringify(payoutConfig, null, 2)}
          </pre>
        </Card>
        <Card depth="flat" padding="sm">
          <CardHeader className="px-1.5 pt-1">
            <CardTitle className="flex items-center gap-2">
              <RefreshCcw className="size-4 text-fg-muted" /> Operational stats
            </CardTitle>
          </CardHeader>
          <ul className="mt-2 space-y-2 px-1.5 text-body-sm">
            <Stat label="Contributors" value={contributorsCount.toString()} />
            <Stat
              label="Platform fee"
              value={`${project.platformFeeBps} bps`}
            />
            <Stat
              label="Created"
              value={formatRelativeTime(project.createdAt)}
            />
            <Stat
              label="Paused at"
              value={
                project.pausedAt ? formatRelativeTime(project.pausedAt) : "—"
              }
            />
            <Stat
              label="Killed at"
              value={
                project.killedAt ? formatRelativeTime(project.killedAt) : "—"
              }
            />
          </ul>
        </Card>
      </section>

      <Card depth="flat" padding="sm">
        <CardHeader className="px-1.5 pt-1">
          <CardTitle className="flex items-center gap-2">
            <Power className="size-4 text-fg-muted" /> Lifecycle log
          </CardTitle>
          <CardDescription>
            Per-project history of pause/kill/snapshot decisions lives in the
            global audit log. Filter by `targetId={project.id}`.
          </CardDescription>
        </CardHeader>
        <p className="mt-2 px-1.5 text-body-sm text-fg-muted">
          Open{" "}
          <Link href="/admin/audit" className="underline underline-offset-2">
            /admin/audit
          </Link>{" "}
          for the full history. Per-project audit chip filter ships in v1.1.
        </p>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-fg-secondary">{label}</span>
      <span className="text-mono-sm text-fg">{value}</span>
    </li>
  );
}

function StatusBadge({
  status,
}: {
  status: "draft" | "launch_configured" | "live" | "paused" | "killed" | "simulated_live";
}) {
  switch (status) {
    case "live":
      return (
        <Badge variant="success" dot>
          Live
        </Badge>
      );
    case "paused":
      return <Badge variant="warning">Paused</Badge>;
    case "killed":
      return <Badge variant="danger">Killed</Badge>;
    default:
      return <Badge variant="default">Draft</Badge>;
  }
}
