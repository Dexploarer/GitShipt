import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { AppShell } from "../_components/AppShell";
import { hasCredentials } from "@/lib/env";
import { isPlatformAdmin } from "@/lib/auth/admin-check";
import { requireAuthSession, toSessionUserChrome } from "@/lib/auth/session";

export default async function DashboardAccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasCredentials.db()) {
    return (
      <AppShell sidebar={<AppSidebar surface={{ kind: "public" }} />}>
        {children}
      </AppShell>
    );
  }

  const session = await requireAuthSession("/dashboard");
  const admin = await isPlatformAdmin(session.user.id);

  return (
    <AppShell
      sidebar={
        <AppSidebar
          user={toSessionUserChrome(session, admin)}
          isPlatformAdmin={admin}
          surface={{ kind: "public" }}
        />
      }
      footerLeft="Account · devnet · BAGS.fm"
    >
      {children}
    </AppShell>
  );
}
