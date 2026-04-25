"use client";

import { Coins, Home, FolderGit2, Wallet } from "lucide-react";
import Link from "next/link";
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
import { ThemeToggle } from "@/components/theme-toggle";

export type DashboardSidebarActive =
  | "overview"
  | "projects"
  | "wallets"
  | "earnings";

const NAV_ITEMS = [
  { key: "overview", label: "Dashboard", icon: Home, href: "/dashboard" },
  {
    key: "projects",
    label: "My Projects",
    icon: FolderGit2,
    href: "/dashboard/projects",
  },
  { key: "wallets", label: "Wallets", icon: Wallet, href: "/dashboard/wallets" },
  { key: "earnings", label: "Earnings", icon: Coins, href: "/dashboard/earnings" },
] as const;

export interface DashboardSidebarProps {
  active?: DashboardSidebarActive;
}

/**
 * Top-level dashboard navigation (Dashboard, My Projects, Wallets, Earnings).
 * Used on `/dashboard`, `/dashboard/wallets`, `/dashboard/earnings`.
 */
export function DashboardSidebar({ active = "overview" }: DashboardSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/" className="flex min-w-0 items-center">
          <CollapsibleBrand />
        </Link>
        <SidebarToggle className="ml-auto" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarSection title="Personal">
          {NAV_ITEMS.map(({ key, label, icon, href }) => (
            <SidebarItem
              key={key}
              icon={icon}
              label={label}
              href={href}
              active={active === key}
            />
          ))}
        </SidebarSection>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-between gap-2">
          <CollapsiblePoweredBy />
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function CollapsibleBrand() {
  const { collapsed } = useSidebar();
  if (collapsed) return null;
  return (
    <span className="flex flex-col leading-tight min-w-0">
      <span className="text-label-md text-fg truncate">GitBags</span>
      <span className="text-caption text-fg-muted truncate">Console</span>
    </span>
  );
}

function CollapsiblePoweredBy() {
  const { collapsed } = useSidebar();
  if (collapsed) return <span className="sr-only">Powered by BAGS.fm</span>;
  return (
    <span className="text-caption text-fg-muted truncate">
      Powered by BAGS.fm
    </span>
  );
}
