"use client";

import {
  BookOpen,
  Coins,
  Compass,
  FileText,
  FolderGit2,
  Home,
  KeyRound,
  LogOut,
  Rocket,
  Shield,
  ShieldAlert,
  Trophy,
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
import { signOutAction } from "./sign-out-action";
import { cn } from "@/lib/utils";

/**
 * Sidebar for signed-in users on global authenticated routes (dashboard,
 * earnings, security, wallets) and for the unauthenticated PUBLIC routes
 * when a session exists (so the visitor still sees their account links
 * while browsing).
 *
 * Mounted by:
 *   - `<PublicAppShell user={...} />` when a session exists
 *   - `<DashboardAppShell />` for top-level /dashboard pages
 *
 * For drill-in views (project deep-dives, admin pages), use
 * `<ContextSidebar>` instead — it carries a "← Return to" affordance.
 */

const PERSONAL_NAV = [
  { key: "dashboard", label: "Dashboard", icon: Home, href: "/dashboard" },
  {
    key: "projects",
    label: "My projects",
    icon: FolderGit2,
    href: "/dashboard/projects",
  },
  {
    key: "earnings",
    label: "Earnings",
    icon: Coins,
    href: "/dashboard/earnings",
  },
  { key: "wallets", label: "Wallets", icon: Wallet, href: "/dashboard/wallets" },
  {
    key: "security",
    label: "Security",
    icon: KeyRound,
    href: "/dashboard/security",
  },
] as const;

const PUBLIC_NAV = [
  { label: "Home", icon: Home, href: "/" },
  { label: "Explore", icon: Compass, href: "/explore" },
  { label: "Leaderboard", icon: Trophy, href: "/leaderboard" },
  { label: "Launch a token", icon: Rocket, href: "/launch" },
  { label: "Docs", icon: BookOpen, href: "/docs" },
] as const;

const LEGAL_NAV = [
  { label: "Terms", icon: FileText, href: "/legal/terms" },
  { label: "Privacy", icon: Shield, href: "/legal/privacy" },
] as const;

export type AuthSidebarActive =
  | "dashboard"
  | "projects"
  | "earnings"
  | "wallets"
  | "security"
  | undefined;

export interface AuthSidebarProps {
  active?: AuthSidebarActive;
  /** Optional — when omitted, the user card + sign-out are hidden (used in stub-mode shells). */
  user?: SidebarUserCardProps | null;
  isPlatformAdmin?: boolean;
  /** When true, hides the Personal section (used when the sidebar mounts
   *  on a public route and the user is just signed in but browsing public). */
  publicChrome?: boolean;
}

export function AuthSidebar({
  active,
  user,
  isPlatformAdmin = false,
  publicChrome = false,
}: AuthSidebarProps) {
  const pathname = usePathname() ?? "";
  const isActive = (href: string, key: AuthSidebarActive) => {
    if (active !== undefined) return active === key;
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };
  const isPathActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/" className="flex min-w-0 items-center">
          <CollapsibleBrand />
        </Link>
        <SidebarToggle className="ml-auto" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarSection title="Public">
          {PUBLIC_NAV.map(({ label, icon, href }) => (
            <SidebarItem
              key={href}
              icon={icon}
              label={label}
              href={href}
              active={isPathActive(href)}
            />
          ))}
        </SidebarSection>

        {!publicChrome ? (
          <>
            <SidebarDivider />
            <SidebarSection title="Account">
              {PERSONAL_NAV.map(({ key, label, icon, href }) => (
                <SidebarItem
                  key={key}
                  icon={icon}
                  label={label}
                  href={href}
                  active={isActive(href, key as AuthSidebarActive)}
                />
              ))}
            </SidebarSection>
          </>
        ) : null}

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
        <FooterLegalRow active={isPathActive} />
        {user ? (
          <>
            <SidebarUserCard
              name={user.name ?? null}
              email={user.email ?? null}
              username={user.username ?? null}
              imageUrl={user.imageUrl ?? null}
            />
            <SidebarSignOutButton />
          </>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <CollapsiblePoweredBy />
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function FooterLegalRow({
  active,
}: {
  active: (href: string) => boolean;
}) {
  const { collapsed } = useSidebar();
  if (collapsed) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-1 pb-1 text-caption text-fg-muted">
      {LEGAL_NAV.map(({ label, href }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "transition-colors hover:text-fg",
            active(href) && "text-fg",
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

function SidebarSignOutButton() {
  const { collapsed, closeMobile } = useSidebar();

  return (
    <form action={signOutAction}>
      <button
        type="submit"
        onClick={closeMobile}
        title={collapsed ? "Sign out" : undefined}
        className={cn(
          "group flex h-9 w-full items-center gap-3 rounded-md px-2.5",
          "text-left text-fg-secondary",
          "transition-[background-color,color,box-shadow] duration-150",
          "hover:bg-danger-soft hover:text-danger",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          collapsed && "lg:justify-center lg:px-0",
        )}
      >
        <LogOut className="size-4 shrink-0" aria-hidden />
        <span className={cn("truncate text-label-md", collapsed && "lg:sr-only")}>
          Sign out
        </span>
      </button>
    </form>
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
