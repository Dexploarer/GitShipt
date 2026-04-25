import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { hasCredentials } from "@/lib/env";
import { hasPermission } from "@/lib/auth/permissions";
import { getProjectRecord } from "@/lib/queries/dashboard";

/**
 * Per-project gate. We re-validate the session here AND check
 * `project.read` so a signed-in stranger gets a 404, not a render of
 * someone else's project.
 *
 * The actual sidebar is rendered inside each page (via AppShell) so the
 * page can pass the right `active=` prop. This layout is purely a security
 * boundary and DB warm-up.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  if (!hasCredentials.db()) return <>{children}</>;

  const { id } = await params;
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user) redirect(`/auth/signin?next=/dashboard/projects/${id}`);

  const project = await getProjectRecord(id);
  if (!project) notFound();

  const canRead = await hasPermission("project.read", {
    userId: session.user.id,
    projectId: id,
  });
  if (!canRead) notFound();

  return <>{children}</>;
}
