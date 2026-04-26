import { BookOpen, Sparkles } from "lucide-react";
import { hasCredentials } from "@/lib/env";
import { loadProjectFor } from "../../../_components/loadProject";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui";
import { Button } from "@repo/ui";
import { EmptyState } from "@/components/shared/EmptyState";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

export const dynamic = "force-dynamic";

export default async function DocsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!hasCredentials.db()) return <Stub />;
  const { id } = await params;
  const ctx = await loadProjectFor(id, "project.read");
  const { project } = ctx;

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects", href: "/dashboard" },
          { label: project.name, href: `/dashboard/projects/${id}` },
          { label: "Docs" },
        ]}
      />
      <header>
        <h1 className="text-headline-lg leading-tight text-fg">Docs</h1>
        <p className="text-body-md text-fg-secondary">
          Per-project docs published to your public page. Authoring lands in
          v1.1.
        </p>
      </header>

      <Card depth="flat" padding="none">
        <CardHeader className="border-b border-border px-6 py-4">
          <CardTitle>No docs published</CardTitle>
          <CardDescription>
            Markdown editor &amp; publish flow ship in v1.1.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <BookOpen className="size-10 text-fg-muted" aria-hidden />
            <p className="max-w-md text-body-md text-fg-secondary">
              Show contributors how to participate, what counts as merit, and
              how to claim. Authoring tools coming in v1.1.
            </p>
            <Button variant="primary" disabled title="Coming v1.1">
              Edit docs
            </Button>
            <span className="text-caption text-fg-muted">
              v1.1 — disabled in this build.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stub() {
  return (
    <div className="mx-auto w-full max-w-content">
      <EmptyState
        icon={Sparkles}
        title="Stub mode"
        description="Set DATABASE_URL to manage docs."
      />
    </div>
  );
}
