import { Suspense } from "react";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { AppShell } from "../_components/AppShell";
import { hasCredentials } from "@/lib/env";
import { requireAuthSession } from "@/lib/auth/session";
import { clusterLabel } from "@/lib/solana/explorer";

export default function DashboardAccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <DashboardAccountLayoutContent>{children}</DashboardAccountLayoutContent>
    </Suspense>
  );
}

async function DashboardAccountLayoutContent({
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
      footerLeft={`Account · ${clusterLabel()} · BAGS.fm`}
    >
      {children}
    </AppShell>
  );
}
