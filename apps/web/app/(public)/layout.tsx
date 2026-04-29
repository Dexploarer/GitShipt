import { Suspense } from "react";
import { PublicAppShell } from "@/components/public/PublicAppShell";
import { getDefaultSidebarCollapsed } from "@/lib/sidebar-state";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <PublicLayoutContent>{children}</PublicLayoutContent>
    </Suspense>
  );
}

async function PublicLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const defaultSidebarCollapsed = await getDefaultSidebarCollapsed();
  return (
    <PublicAppShell defaultSidebarCollapsed={defaultSidebarCollapsed}>
      {children}
    </PublicAppShell>
  );
}
