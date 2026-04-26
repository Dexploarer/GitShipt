"use client";

import {
  Coins,
  FolderGit2,
  Home,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarDivider,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
  SidebarToggle,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarUserCard, type SidebarUserCardProps } from "./SidebarUserCard";
import { cn } from "@/lib/utils";

export type DashboardSidebarActive =
  | "overview"
  | "projects"
  | "wallets"
  | "earnings";

const NAV_ITEMS: ReadonlyArray<{
  key: DashboardSidebarActive;
  label: string;
  icon: typeof Home;
  href: string;
}> = [
  { key: "overview", label: "Dashboard", icon: Home, href: "/dashboard" },
  {
    key: "projects",
    label: "My Projects",
    icon: FolderGit2,
    href: "/dashboard/projects",
  },
  { key: "wallets", label: "Wallets", icon: Wallet, href: "/dashboard/wallets" },
  { key: "earnings", label: "Earnings", icon: Coins, href: "/dashboard/earnings" },
];

export interface DashboardSidebarProps {
  active?: DashboardSidebarActive;
  /** Optional signed-in user for the footer card. */
  user?: SidebarUserCardProps | null;
  /** When true, renders an "Admin console" entry under Personal. */
  isPlatformAdmin?: boolean;
}

/**
 * Top-level dashboard navigation (Dashboard, My Projects, Wallets, Earnings).
 * Used on `/dashboard`, `/dashboard/wallets`, `/dashboard/earnings`.
 *
 * Active state: prefers the `active` prop; falls back to a `usePathname()`
 * derivation so consumers that forget to pass `active` still get the right
 * highlight.
 */
export function DashboardSidebar({
  active,
  user,
  isPlatformAdmin = false,
}: DashboardSidebarProps) {
  const pathname = usePathname() ?? "";
  const derivedActive: DashboardSidebarActive | undefined = (() => {
    if (active) return active;
    if (pathname === "/dashboard") return "overview";
    if (pathname.startsWith("/dashboard/projects")) return "projects";
    if (pathname.startsWith("/dashboard/wallets")) return "wallets";
    if (pathname.startsWith("/dashboard/earnings")) return "earnings";
    return undefined;
  })();

  const signedIn = Boolean(user && (user.name || user.email));

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
              active={derivedActive === key}
            />
          ))}
        </SidebarSection>

        {isPlatformAdmin ? (
          <>
            <SidebarDivider />
            <SidebarSection title="Platform">
              <SidebarItem
                icon={ShieldAlert}
                label="Admin console"
                href="/admin"
              />
            </SidebarSection>
          </>
        ) : null}
      </SidebarContent>

      <SidebarFooter>
        {signedIn && user ? (
          <SidebarUserCard
            name={user.name ?? null}
            email={user.email ?? null}
            username={user.username ?? null}
            imageUrl={user.imageUrl ?? null}
          />
        ) : null}
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
  return (
    <span
      className={cn(
        "flex flex-col leading-tight min-w-0",
        collapsed && "lg:hidden",
      )}
    >
      <span className="text-label-md text-fg truncate">GitBags</span>
      <span className="text-caption text-fg-muted truncate">Console</span>
    </span>
  );
}

function CollapsiblePoweredBy() {
  const { collapsed } = useSidebar();
  return (
    <span
      className={cn(
        "text-caption text-fg-muted truncate",
        collapsed && "lg:sr-only",
      )}
    >
      Powered by BAGS.fm
    </span>
  );
}
