"use client";

import {
  BookOpen,
  Coins,
  Github,
  History,
  Key,
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
import { cn } from "@/lib/utils";

export interface ProjectSidebarProps {
  slug: string;
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
}

const NAV_ITEMS = [
  { key: "leaderboard", label: "Leaderboard", icon: Trophy, suffix: "" },
  { key: "payouts", label: "Payouts", icon: Coins, suffix: "/payouts" },
  { key: "snapshots", label: "Snapshots", icon: History, suffix: "/snapshots" },
  { key: "token", label: "Token", icon: Sparkles, suffix: "/token" },
  { key: "repository", label: "Repository", icon: Github, suffix: "/repository" },
] as const;

const ADMIN_ITEMS = [
  { key: "settings", label: "Settings", icon: Settings, suffix: "/settings" },
  { key: "api-keys", label: "API Keys", icon: Key, suffix: "/api-keys" },
  { key: "team", label: "Team", icon: Users, suffix: "/team" },
] as const;

const FOOTER_NAV = [
  { key: "docs", label: "Docs", icon: BookOpen, suffix: "/docs" },
] as const;

export function ProjectSidebar({
  slug,
  active = "leaderboard",
  canAdmin = false,
  token,
  wallet,
}: ProjectSidebarProps) {
  const projectBase = `/r/${slug}`;
  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/" className="flex min-w-0 items-center">
          <CollapsibleBrand />
        </Link>
        <SidebarToggle className="ml-auto" />
      </SidebarHeader>

      <SidebarContent>
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

        {canAdmin ? (
          <SidebarSection title="Admin">
            {ADMIN_ITEMS.map(({ key, label, icon, suffix }) => (
              <SidebarItem
                key={key}
                icon={icon}
                label={label}
                href={`${projectBase}${suffix}`}
                active={active === key}
              />
            ))}
          </SidebarSection>
        ) : (
          <SidebarSection title="Account">
            <SidebarItem
              icon={Wallet}
              label="Sign in to claim"
              href="/auth/signin"
            />
          </SidebarSection>
        )}

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
    <div className={cn("space-y-2", collapsed && "hidden")}>
      <TokenSparkCard {...token} />
      <UserWalletCard {...wallet} />
    </div>
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
