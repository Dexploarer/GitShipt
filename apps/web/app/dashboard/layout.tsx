import { Suspense } from "react";
import { SidebarProvider } from "@repo/ui";
import { hasCredentials } from "@/lib/env";
import { requireAuthSession } from "@/lib/auth/session";
import { getDefaultSidebarCollapsed } from "@/lib/sidebar-state";

/**
 * `/dashboard/**` shell. Wraps every dashboard route in a SidebarProvider
 * so per-page sidebars share collapse state.
 *
 * Auth re-validation (CVE-2025-29927 mitigation): proxy.ts already redirects
 * unauthenticated users away from `/dashboard/*`, but we re-check the session
 * here so a forged `x-middleware-subrequest` header cannot bypass the gate.
 *
 * The route-group layouts below this boundary own their persistent chrome.
 * This root layout stays minimal so the account shell and per-project shell
 * do not nest inside each other.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}

async function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  // Stub mode (no DB configured) — defer to the page to render its own
  // explanation. We can't call auth() reliably without a DB.
  if (!hasCredentials.db()) {
    const defaultSidebarCollapsed = await getDefaultSidebarCollapsed();
    return (
      <SidebarProvider defaultCollapsed={defaultSidebarCollapsed}>
        {children}
      </SidebarProvider>
    );
  }

  await requireAuthSession("/dashboard");
  const defaultSidebarCollapsed = await getDefaultSidebarCollapsed();

  return (
    <SidebarProvider defaultCollapsed={defaultSidebarCollapsed}>
      {children}
    </SidebarProvider>
  );
}
