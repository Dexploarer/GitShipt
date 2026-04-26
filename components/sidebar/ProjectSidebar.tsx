"use client";

import {
  BookOpen,
  Coins,
  Github,
  History,
  Key,
  LayoutDashboard,
  Settings,
  Sparkles,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
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
import { TokenSparkCard, type TokenSparkCardProps } from "./TokenSparkCard";
import { UserWalletCard, type UserWalletCardProps } from "./UserWalletCard";
import { SidebarUserCard, type SidebarUserCardProps } from "./SidebarUserCard";
import { cn } from "@/lib/utils";

export interface ProjectSidebarProps {
  slug: string;
  /** Project ID — required to link admin items to the dashboard owner views. */
  projectId?: string;
  active?:
    | "leaderboard"
    | "payouts"
    | "snapshots"
    | "repository"
    | "token"
    | "settings"
    | "api-keys"
    | "team"
    | "docs";
  canAdmin?: boolean;
  token: TokenSparkCardProps;
  wallet: UserWalletCardProps;
  /** Signed-in user. Pass `null` to render the wallet/sign-in CTA in the footer. */
  user?: SidebarUserCardProps | null;
}

const NAV_ITEMS = [
  { key: "leaderboard", label: "Leaderboard", icon: Trophy, suffix: "" },
  { key: "payouts", label: "Payouts", icon: Coins, suffix: "/payouts" },
  { key: "snapshots", label: "Snapshots", icon: History, suffix: "/snapshots" },
  { key: "token", label: "Token", icon: Sparkles, suffix: "/token" },
  { key: "repository", label: "Repository", icon: Github, suffix: "/repository" },
] as const;

const ADMIN_DASHBOARD_ITEMS = [
  { key: "settings", label: "Settings", icon: Settings, suffix: "" },
  { key: "api-keys", label: "API Keys", icon: Key, suffix: "/api-keys" },
  { key: "team", label: "Team", icon: Users, suffix: "/team" },
] as const;

const FOOTER_NAV = [
  { key: "docs", label: "Docs", icon: BookOpen, suffix: "/docs" },
] as const;

export function ProjectSidebar({
  slug,
  projectId,
  active = "leaderboard",
  canAdmin = false,
  token,
  wallet,
  user,
}: ProjectSidebarProps) {
  const projectBase = `/r/${slug}`;
  const dashboardBase = projectId ? `/dashboard/projects/${projectId}` : null;
  const showAdmin = canAdmin && Boolean(dashboardBase);
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
        {showAdmin && dashboardBase ? (
          <>
            <SidebarSection title="Manage">
              <SidebarItem
                icon={LayoutDashboard}
                label="Manage in dashboard"
                href={dashboardBase}
              />
            </SidebarSection>
            <SidebarDivider />
          </>
        ) : null}

        <SidebarSection title="Project">
          {NAV_ITEMS.map(({ key, label, icon, suffix }) => (
            <SidebarItem
              key={key}
              icon={icon}
              label={label}
              href={`${projectBase}${suffix}`}
              active={active === key}
            />
          ))}
        </SidebarSection>

        {showAdmin && dashboardBase ? (
          <SidebarSection title="Admin">
            {ADMIN_DASHBOARD_ITEMS.map(({ key, label, icon, suffix }) => (
              <SidebarItem
                key={key}
                icon={icon}
                label={label}
                // Admin items always link to dashboard owner views, never
                // to non-existent /r/{slug}/settings etc.
                href={`${dashboardBase}${suffix}`}
                active={active === key}
              />
            ))}
          </SidebarSection>
        ) : !signedIn ? (
          <SidebarSection title="Account">
            <SidebarItem
              icon={Wallet}
              label="Sign in to claim"
              href="/auth/signin"
            />
          </SidebarSection>
        ) : null}

        <SidebarSection title="Resources">
          {FOOTER_NAV.map(({ key, label, icon, suffix }) => (
            <SidebarItem
              key={key}
              icon={icon}
              label={label}
              href={`${projectBase}${suffix}`}
              active={active === key}
            />
          ))}
        </SidebarSection>
      </SidebarContent>

      <SidebarFooter>
        <CollapsibleCards token={token} wallet={wallet} />
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
      <span className="text-caption text-fg-muted truncate">by BAGS.fm</span>
    </span>
  );
}

function CollapsibleCards({
  token,
  wallet,
}: {
  token: TokenSparkCardProps;
  wallet: UserWalletCardProps;
}) {
  const { collapsed } = useSidebar();
  return (
    <div className={cn("space-y-2", collapsed && "lg:hidden")}>
      <TokenSparkCard {...token} />
      <UserWalletCard {...wallet} />
    </div>
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
