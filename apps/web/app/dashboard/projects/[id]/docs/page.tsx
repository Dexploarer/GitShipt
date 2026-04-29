import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { hasCredentials } from "@/lib/env";
import { loadProjectFor } from "../../../_components/loadProject";
import { getProjectDocs } from "@/lib/queries/project-docs";
import { EmptyState } from "@/components/shared/EmptyState";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { ProjectDocsEditor } from "./_components/ProjectDocsEditor";


export default function DocsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <DocsPageContent params={params} />
    </Suspense>
  );
}

async function DocsPageContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!hasCredentials.db()) return <Stub />;
  const { id } = await params;
  const ctx = await loadProjectFor(id, "project.update");
  const { project } = ctx;
  const docs = await getProjectDocs(id);

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects", href: "/dashboard/projects" },
          { label: project.name, href: `/dashboard/projects/${id}` },
          { label: "Docs" },
        ]}
      />

      <ProjectDocsEditor
        projectId={id}
        initialMarkdown={docs.markdown}
        initialPublished={docs.published}
        updatedAt={docs.updatedAt}
      />
    </div>
  );
}

function Stub() {
  return (
    <div className="mx-auto w-full max-w-content">
      <EmptyState
        icon={Sparkles}
        title="Stub mode"
        description="Set DATABASE_URL or POSTGRES_URL to manage docs."
      />
    </div>
  );
}
