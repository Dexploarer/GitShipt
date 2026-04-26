import { Sparkles, UserPlus, Users } from "lucide-react";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { hasCredentials } from "@/lib/env";
import { getProjectMembers } from "@/lib/queries/dashboard";
import { formatRelativeTime } from "@/lib/format";
import { loadProjectFor } from "../../../_components/loadProject";
import { AppShell } from "../../../_components/AppShell";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!hasCredentials.db()) return <Stub />;
  const { id } = await params;
  const ctx = await loadProjectFor(id, "project.update");
  const { project } = ctx;
  const members = await getProjectMembers(id);

  return (
    <AppShell
      sidebar={
        <AppSidebar
          surface={{
            kind: "owner-project",
            projectId: id,
            projectName: project.name,
            slug: project.slug,
          }}
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
            { label: "Team" },
          ]}
        />
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-headline-lg leading-tight text-fg">Team</h1>
            <p className="text-body-md text-fg-secondary">
              Co-administrators with access to this project's console.
            </p>
          </div>
          <Button variant="primary" disabled title="Coming v1.1">
            <UserPlus className="size-4" /> Invite member
          </Button>
        </header>

        <Card depth="flat" padding="none">
          <CardHeader className="border-b border-border px-6 py-4">
            <CardTitle>
              {members.length} member{members.length === 1 ? "" : "s"}
            </CardTitle>
            <CardDescription>
              Owner is shown elsewhere. Invitations land in v1.1.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {members.length === 0 ? (
              <div className="px-6 py-10">
                <EmptyState
                  icon={Users}
                  title="No co-admins yet"
                  description="You're flying solo. Invitations open in v1.1."
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {members.map((m) => (
                  <li
                    key={m.userId}
                    className="grid grid-cols-[40px_minmax(0,1fr)_auto_auto] items-center gap-3 px-6 py-3"
                  >
                    {m.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.image}
                        alt={m.name}
                        className="size-10 rounded-full border border-border object-cover"
                      />
                    ) : (
                      <span className="grid size-10 place-items-center rounded-full bg-surface-elevated text-label-sm text-fg-muted">
                        {m.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-label-md text-fg">
                        {m.name}
                      </div>
                      <div className="truncate text-mono-sm text-fg-muted">
                        {m.email}
                      </div>
                    </div>
                    <Badge variant="default" size="sm">
                      {m.role.replace("project_", "")}
                    </Badge>
                    <span className="text-caption text-fg-muted">
                      {formatRelativeTime(m.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
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
        <AppSidebar
          surface={{
            kind: "owner-project",
            projectId: "",
            projectName: "—",
            slug: "—/—",
          }}
        />
      }
    >
      <div className="mx-auto w-full max-w-content">
        <EmptyState
          icon={Sparkles}
          title="Stub mode"
          description="Set DATABASE_URL to view team members."
        />
      </div>
    </AppShell>
  );
}
