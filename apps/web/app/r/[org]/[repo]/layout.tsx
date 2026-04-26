import { notFound } from "next/navigation";
import { ProjectShell } from "./_components/ProjectShell";
import { getProjectShellChrome } from "@/lib/auth/project-chrome";
import { getProjectPageData } from "@/lib/queries/project-page";
import { getDefaultSidebarCollapsed } from "@/lib/sidebar-state";

type Params = Promise<{ org: string; repo: string }>;

/**
 * Owns the project chrome for every public repo route.
 *
 * Auth is resolved once for the route segment and passed to the sidebar as
 * stable chrome data; every mutating action still revalidates permissions
 * independently.
 */
export default async function PublicProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { org, repo } = await params;
  const data = await getProjectPageData(org, repo);
  if (!data) notFound();

  const { header } = data;
  const { user, canAdmin } = await getProjectShellChrome(header.id);
  const defaultSidebarCollapsed = await getDefaultSidebarCollapsed();

  return (
    <ProjectShell
      header={header}
      canAdmin={canAdmin}
      user={user}
      defaultSidebarCollapsed={defaultSidebarCollapsed}
    >
      {children}
    </ProjectShell>
  );
}
