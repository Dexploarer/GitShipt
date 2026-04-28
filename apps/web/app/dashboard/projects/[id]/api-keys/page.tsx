import { Sparkles } from "lucide-react";
import { hasCredentials } from "@/lib/env";
import { loadProjectFor } from "../../../_components/loadProject";
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
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Projects", href: "/dashboard/projects" },
            { label: project.name, href: `/dashboard/projects/${id}` },
            { label: "API keys" },
          ]}
        />
        <CreateApiKeyForm projectId={id} />
      </div>

      <section aria-label="Active API keys">
        <h2 className="sr-only">Active keys</h2>
        <ApiKeyTable projectId={id} keys={keys} />
      </section>
    </div>
  );
}

function Stub() {
  return (
    <div className="mx-auto w-full max-w-content">
      <EmptyState
        icon={Sparkles}
        title="Stub mode"
        description="Set DATABASE_URL or POSTGRES_URL to view API keys."
      />
    </div>
  );
}
