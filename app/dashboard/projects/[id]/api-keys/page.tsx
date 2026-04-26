import { Sparkles } from "lucide-react";
import { hasCredentials } from "@/lib/env";
import { loadProjectFor } from "../../../_components/loadProject";
import { AppShell } from "../../../_components/AppShell";
import { OwnerProjectContextSidebar } from "@/components/sidebar/contexts/OwnerProjectContextSidebar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { listApiKeysForProject } from "@/lib/queries/api-keys";
import { CreateApiKeyForm } from "./_components/CreateApiKeyForm";
import { ApiKeyTable } from "./_components/ApiKeyTable";

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
  const keys = await listApiKeysForProject(id);

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
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-headline-lg leading-tight text-fg">API keys</h1>
            <p className="text-body-md text-fg-secondary">
              Programmatic, revocable tokens scoped to this project. Raw keys
              are shown once at creation — store them somewhere safe.
            </p>
          </div>
          <CreateApiKeyForm projectId={id} />
        </header>

        <section aria-label="Active API keys">
          <h2 className="sr-only">Active keys</h2>
          <ApiKeyTable projectId={id} keys={keys} />
        </section>
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
