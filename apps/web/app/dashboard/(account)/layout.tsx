import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { AppShell } from "../_components/AppShell";
import { hasCredentials } from "@/lib/env";
import { requireAuthSession } from "@/lib/auth/session";

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

  await requireAuthSession("/dashboard");

  return (
    <AppShell
      sidebar={<AppSidebar surface={{ kind: "public" }} />}
      footerLeft="Account · devnet · BAGS.fm"
    >
      {children}
    </AppShell>
  );
}
