"use client";

import {
  Activity,
  AlertTriangle,
  Banknote,
  Coins,
  Database,
  FileSearch,
  Flag,
  GaugeCircle,
  Layers,
  PlugZap,
  Power,
  ShieldAlert,
  Sparkles,
  Users,
  Vault,
  Workflow,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
  SidebarToggle,
  useSidebar,
} from "@/components/ui/sidebar";
import { Pill } from "@/components/ui/pill";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * AdminSidebar — global super-admin navigation.
 *
 * Shows an unmistakable `[Admin: SUPER]` pill in the header so every operator
 * immediately knows they're in the elevated console (per DESIGN.md: danger-soft
 * fill, danger fg). The footer carries the ThemeToggle.
 */
export function AdminSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/admin" className="flex min-w-0 items-center gap-2">
          <CollapsibleBrand />
        </Link>
        <SidebarToggle className="ml-auto" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarSection title="Operations">
          <SidebarItem
            icon={GaugeCircle}
            label="Dashboard"
            href="/admin"
            active={isActive("/admin") && pathname === "/admin"}
          />
          <SidebarItem
            icon={Workflow}
            label="Workflows"
            href="/admin/workflows"
            active={isActive("/admin/workflows")}
          />
          <SidebarItem
            icon={FileSearch}
            label="Audit"
            href="/admin/audit"
            active={isActive("/admin/audit")}
          />
        </SidebarSection>

        <SidebarSection title="Marketplace">
          <SidebarItem
            icon={Layers}
            label="Projects"
            href="/admin/projects"
            active={isActive("/admin/projects")}
          />
          <SidebarItem
            icon={Users}
            label="Users"
            href="/admin/users"
            active={isActive("/admin/users")}
          />
          <SidebarItem
            icon={Coins}
            label="Payouts"
            href="/admin/payouts"
            active={isActive("/admin/payouts")}
          />
          <SidebarItem
            icon={Sparkles}
            label="Snapshots"
            href="/admin/snapshots"
            active={isActive("/admin/snapshots")}
          />
        </SidebarSection>

        <SidebarSection title="Treasury">
          <SidebarItem
            icon={Vault}
            label="Treasury"
            href="/admin/treasury"
            active={isActive("/admin/treasury")}
          />
          <SidebarItem
            icon={Banknote}
            label="Fees"
            href="/admin/fees"
            active={isActive("/admin/fees")}
          />
        </SidebarSection>

        <SidebarSection title="Platform">
          <SidebarItem
            icon={Power}
            label="Maintenance"
            href="/admin/maintenance"
            active={isActive("/admin/maintenance")}
          />
          <SidebarItem
            icon={PlugZap}
            label="Integrations"
            href="/admin/integrations"
            active={isActive("/admin/integrations")}
          />
          <SidebarItem
            icon={ShieldAlert}
            label="Abuse"
            href="/admin/abuse"
            active={isActive("/admin/abuse")}
          />
          <SidebarItem
            icon={Flag}
            label="Feature Flags"
            href="/admin/feature-flags"
            active={isActive("/admin/feature-flags")}
          />
          <SidebarItem
            icon={Database}
            label="DB"
            href="/admin/db"
            active={isActive("/admin/db")}
          />
        </SidebarSection>
      </SidebarContent>

      <SidebarFooter>
        <CollapsibleEnvLine />
        <div className="flex items-center justify-between gap-2">
          <CollapsibleAlertTag />
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function CollapsibleBrand() {
  const { collapsed } = useSidebar();
  if (collapsed) {
    return (
      <span
        className="inline-flex size-7 items-center justify-center rounded-md bg-danger-soft text-danger"
        title="GitBags · Admin"
      >
        <ShieldAlert className="size-4" />
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex flex-col leading-tight min-w-0">
        <span className="truncate text-label-md text-fg">GitBags</span>
        <span className="truncate text-caption text-fg-muted">Ops console</span>
      </span>
      <Pill className="ml-1 bg-danger-soft text-danger" size="sm">
        Admin: SUPER
      </Pill>
    </span>
  );
}

function CollapsibleEnvLine() {
  const { collapsed } = useSidebar();
  if (collapsed) return null;
  return (
    <div className="flex items-center gap-1.5 text-caption text-fg-muted">
      <Activity className="size-3" aria-hidden />
      <span className="truncate">devnet · super-admin realm</span>
    </div>
  );
}

function CollapsibleAlertTag() {
  const { collapsed } = useSidebar();
  if (collapsed) {
    return (
      <span className="sr-only">Destructive actions require MFA + reason.</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-caption text-danger">
      <AlertTriangle className="size-3" aria-hidden />
      <span className="truncate">Wrench-grade access</span>
      <Wrench className="size-3 sr-only" aria-hidden />
    </span>
  );
}
