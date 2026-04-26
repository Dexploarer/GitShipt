import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { redirect } from "next/navigation";
import { Rocket, FolderGit2 } from "lucide-react";
import { hasCredentials } from "@/lib/env";
import { getAuthSession } from "@/lib/auth/session";
import { getMyProjects } from "@/lib/queries/dashboard";
import { AppShell } from "../_components/AppShell";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ProjectList } from "../page";

export const dynamic = "force-dynamic";

/**
 * `/dashboard/projects` — full list of projects the user owns or admins.
 * Same data as `/dashboard` but with the page-level emphasis on the list
 * (no top KPI tiles).
 */
export default async function ProjectsPage() {
  if (!hasCredentials.db()) {
    return (
      <AppShell sidebar={<AppSidebar surface={{ kind: "public" }} />}>
        <div className="mx-auto w-full max-w-content">
          <EmptyState
            icon={FolderGit2}
            title="Stub mode"
            description="Set DATABASE_URL to view your projects."
            cta={{ label: "Sign in", href: "/auth/signin" }}
          />
        </div>
      </AppShell>
    );
  }

  const session = await getAuthSession();
  if (!session?.user) redirect("/auth/signin?next=/dashboard/projects");

  const projects = await getMyProjects(session.user.id);

  return (
    <AppShell
      sidebar={
        <AppSidebar user={{
            name: session.user.name ?? null,
            email: session.user.email ?? null,
            username:
              (session.user as { githubUsername?: string | null }).githubUsername ??
              null,
            imageUrl: session.user.image ?? null,
          }} surface={{ kind: "public" }} />
      }
      footerLeft={`${session.user.name ?? session.user.email} · devnet · BAGS.fm`}
    >
      <div className="mx-auto flex w-full max-w-content flex-col gap-4">
        <header>
          <h1 className="text-headline-lg leading-tight text-fg">My Projects</h1>
          <p className="text-body-md text-fg-secondary">
            All repositories you own or co-administer on GitBags.
          </p>
        </header>

        <Card depth="flat" padding="none">
          <CardHeader className="border-b border-border px-6 py-4">
            <CardTitle>{projects.length} project{projects.length === 1 ? "" : "s"}</CardTitle>
            <CardDescription>
              Tap any row to open the per-project console.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {projects.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Rocket}
                  title="Launch your first token"
                  description="Mint a Bags.fm token for your repo and start the daily fee pool."
                  cta={{ label: "Launch a token", href: "/launch" }}
                />
              </div>
            ) : (
              <ProjectList rows={projects} />
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
