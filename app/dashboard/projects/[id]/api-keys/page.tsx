import { Key, Sparkles } from "lucide-react";
import { hasCredentials } from "@/lib/env";
import { loadProjectFor } from "../../../_components/loadProject";
import { AppShell } from "../../../_components/AppShell";
import { OwnerProjectContextSidebar } from "@/components/sidebar/contexts/OwnerProjectContextSidebar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!hasCredentials.db()) return <Stub />;
  const { id } = await params;
  const ctx = await loadProjectFor(id, "project.update");
  const { project } = ctx;

  return (
    <AppShell
      sidebar={
        <OwnerProjectContextSidebar
          projectId={id}
          slug={project.slug}
          projectName={project.name}
        />
      }
      footerLeft={`${project.slug} · devnet · BAGS.fm`}
    >
      <div className="mx-auto flex w-full max-w-content flex-col gap-4">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Projects", href: "/dashboard" },
            { label: project.name, href: `/dashboard/projects/${id}` },
            { label: "API keys" },
          ]}
        />
        <header>
          <h1 className="text-headline-lg leading-tight text-fg">API keys</h1>
          <p className="text-body-md text-fg-secondary">
            Programmatic access to project data. v0 ships read-only — issuing &amp;
            rotation lands in v1.1.
          </p>
        </header>

        <Card depth="flat" padding="none">
          <CardHeader className="border-b border-border px-6 py-4">
            <CardTitle>0 active keys</CardTitle>
            <CardDescription>
              No API keys have been issued for this project.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <Key className="size-10 text-fg-muted" aria-hidden />
              <p className="text-body-md text-fg-secondary max-w-md">
                Issue scoped, rotate-able tokens to query leaderboard / payout
                data from your own backend or CI. Coming in v1.1.
              </p>
              <Button variant="primary" disabled title="Coming v1.1">
                Generate API key
              </Button>
              <span className="text-caption text-fg-muted">
                v1.1 — disabled in this build.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Stub() {
  return (
    <AppShell
      sidebar={
        <OwnerProjectContextSidebar
          projectId=""
          slug="—/—"
          projectName="—"
        />
      }
    >
      <div className="mx-auto w-full max-w-content">
        <EmptyState
          icon={Sparkles}
          title="Stub mode"
          description="Set DATABASE_URL to view API keys."
        />
      </div>
    </AppShell>
  );
}
