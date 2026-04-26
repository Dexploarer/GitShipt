import { redirect } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { hasCredentials } from "@/lib/env";
import { getAuthSession } from "@/lib/auth/session";

/**
 * `/dashboard/**` shell. Wraps every dashboard route in a SidebarProvider
 * so per-page sidebars share collapse state.
 *
 * Auth re-validation (CVE-2025-29927 mitigation): proxy.ts already redirects
 * unauthenticated users away from `/dashboard/*`, but we re-check the session
 * here so a forged `x-middleware-subrequest` header cannot bypass the gate.
 *
 * The per-page UI (sidebar + bento) is composed inside each route via
 * `<AppShell sidebar={…}>`. We keep the layout itself minimal.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Stub mode (no DB configured) — defer to the page to render its own
  // explanation. We can't call auth() reliably without a DB.
  if (!hasCredentials.db()) {
    return <SidebarProvider>{children}</SidebarProvider>;
  }

  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/auth/signin?next=/dashboard");
  }

  return <SidebarProvider>{children}</SidebarProvider>;
}
