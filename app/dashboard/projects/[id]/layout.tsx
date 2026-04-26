import { notFound, redirect } from "next/navigation";
import { hasCredentials } from "@/lib/env";
import { hasPermission } from "@/lib/auth/permissions";
import { getProjectRecord } from "@/lib/queries/dashboard";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { AppShell } from "../../_components/AppShell";
import { getAuthSession } from "@/lib/auth/session";

/**
 * Per-project gate. We re-validate the session here AND check
 * `project.read` so a signed-in stranger gets a 404, not a render of
 * someone else's project.
 *
 * The app shell lives here instead of inside each page so sibling route
 * navigation keeps the sidebar, footer, and provider state mounted. Pages
 * still re-check their own narrower permissions before reading data.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  if (!hasCredentials.db()) {
    return (
      <AppShell
        sidebar={
          <AppSidebar
            surface={{
              kind: "owner-project",
              projectId: "",
              projectName: "Stub mode",
              slug: "db/offline",
            }}
          />
        }
      >
        {children}
      </AppShell>
    );
  }

  const { id } = await params;
  const session = await getAuthSession();
  if (!session?.user) redirect(`/auth/signin?next=/dashboard/projects/${id}`);

  const project = await getProjectRecord(id);
  if (!project) notFound();

  const canRead = await hasPermission("project.read", {
    userId: session.user.id,
    projectId: id,
  });
  if (!canRead) notFound();

  const user = {
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    username:
      (session.user as { githubUsername?: string | null }).githubUsername ??
      null,
    imageUrl: session.user.image ?? null,
  };

  return (
    <AppShell
      sidebar={
        <AppSidebar
          user={user}
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
      {children}
    </AppShell>
  );
}
