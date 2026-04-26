import { PublicAppShell } from "@/components/public/PublicAppShell";
import { getDefaultSidebarCollapsed } from "@/lib/sidebar-state";

export default async function PublicLayout({
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
