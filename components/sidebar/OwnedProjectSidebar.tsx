"use client";

import {
  ArrowLeft,
  BookOpen,
  Coins,
  ExternalLink,
  Eye,
  Github,
  History,
  Home,
  Key,
  Settings,
  Sparkles,
  Trophy,
  Users,
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
import { SidebarUserCard, type SidebarUserCardProps } from "./SidebarUserCard";
import { cn } from "@/lib/utils";

export type OwnedProjectActive =
  | "overview"
  | "leaderboard"
  | "payouts"
  | "repository"
  | "token"
  | "settings"
  | "api-keys"
  | "team"
  | "docs";

export interface OwnedProjectSidebarProps {
  projectId: string;
  slug: string; // owner/repo, used for the public link only
  projectName: string;
  active?: OwnedProjectActive;
  /** Optional signed-in user for the footer card. */
  user?: SidebarUserCardProps | null;
}

const PROJECT_ITEMS = [
  { key: "overview", label: "Overview", icon: Home, suffix: "" },
  { key: "leaderboard", label: "Leaderboard", icon: Trophy, suffix: "/leaderboard" },
  { key: "payouts", label: "Payouts", icon: Coins, suffix: "/payouts" },
  { key: "repository", label: "Repository", icon: Github, suffix: "/repository" },
  { key: "token", label: "Token", icon: Sparkles, suffix: "/token" },
] as const;

const ADMIN_ITEMS = [
  { key: "settings", label: "Settings", icon: Settings, suffix: "/settings" },
  { key: "api-keys", label: "API Keys", icon: Key, suffix: "/api-keys" },
  { key: "team", label: "Team", icon: Users, suffix: "/team" },
] as const;

const FOOTER_NAV = [
  { key: "docs", label: "Docs", icon: BookOpen, suffix: "/docs" },
] as const;

/**
 * Public counterparts — link to the visitor-facing version of each surface.
 * Lets owners flip between the admin view and what their contributors see
 * without leaving the sidebar.
 */
const PUBLIC_ITEMS = [
  { key: "leaderboard", label: "Public leaderboard", icon: Eye, suffix: "" },
  { key: "payouts", label: "Public payouts", icon: Coins, suffix: "/payouts" },
  { key: "snapshots", label: "Snapshots ledger", icon: History, suffix: "/snapshots" },
  { key: "token", label: "Public token page", icon: Sparkles, suffix: "/token" },
  { key: "repository", label: "Public repo page", icon: Github, suffix: "/repository" },
  { key: "docs", label: "Public docs", icon: BookOpen, suffix: "/docs" },
] as const;

/**
 * Per-project admin sidebar — used on `/dashboard/projects/[id]/**`.
 * Structurally a sibling of `ProjectSidebar` with `canAdmin=true`, plus a
 * back-to-dashboard link at the top so the user always has an exit hatch.
 */
export function OwnedProjectSidebar({
  projectId,
  slug,
  projectName,
  active = "overview",
  user,
}: OwnedProjectSidebarProps) {
  const base = `/dashboard/projects/${projectId}`;
  const signedIn = Boolean(user && (user.name || user.email));
  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/dashboard" className="flex min-w-0 items-center">
          <CollapsibleBrand projectName={projectName} slug={slug} />
        </Link>
        <SidebarToggle className="ml-auto" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarSection>
          <SidebarItem
            icon={ArrowLeft}
            label="Back to dashboard"
            href="/dashboard"
          />
        </SidebarSection>

        <SidebarDivider />

        <SidebarSection title="Project">
          {PROJECT_ITEMS.map(({ key, label, icon, suffix }) => (
            <SidebarItem
              key={key}
              icon={icon}
              label={label}
              href={`${base}${suffix}`}
              active={active === key}
            />
          ))}
        </SidebarSection>

        <SidebarSection title="Admin">
          {ADMIN_ITEMS.map(({ key, label, icon, suffix }) => (
            <SidebarItem
              key={key}
              icon={icon}
              label={label}
              href={`${base}${suffix}`}
              active={active === key}
            />
          ))}
        </SidebarSection>

        <SidebarSection title="Resources">
          {FOOTER_NAV.map(({ key, label, icon, suffix }) => (
            <SidebarItem
              key={key}
              icon={icon}
              label={label}
              href={`${base}${suffix}`}
              active={active === key}
            />
          ))}
        </SidebarSection>

        <SidebarSection title="Public view">
          {PUBLIC_ITEMS.map(({ key, label, icon, suffix }) => (
            <SidebarItem
              key={`public-${key}`}
              icon={icon}
              label={label}
              href={`/r/${slug}${suffix}`}
              badge={<ExternalLink className="size-3 text-fg-muted" aria-hidden />}
            />
          ))}
        </SidebarSection>
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

function CollapsibleBrand({
  projectName,
  slug,
}: {
  projectName: string;
  slug: string;
}) {
  const { collapsed } = useSidebar();
  return (
    <span
      className={cn(
        "flex flex-col leading-tight min-w-0",
        collapsed && "lg:hidden",
      )}
    >
      <span className="text-label-md text-fg truncate">{projectName}</span>
      <span className="text-caption text-fg-muted truncate">{slug}</span>
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
