"use client";

import {
  BookOpen,
  Coins,
  Github,
  History,
  KeyRound,
  Settings,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import {
  ContextSidebar,
  type ContextSidebarGroup,
} from "../ContextSidebar";
import type { SidebarUserCardProps } from "../SidebarUserCard";

/**
 * Sidebar for visitors viewing a public project deep-dive (every page
 * under `/r/[org]/[repo]/*`).
 *
 * Header: project name + slug. Body: project nav. When `canAdmin` is true,
 * the owner-only management items appear in a second group with links
 * back into `/dashboard/projects/[id]/*`.
 *
 * Returns to whichever origin the user came from (`?from=...`); defaults
 * to `/explore` when missing.
 */
export interface PublicProjectContextSidebarProps {
  projectId: string;
  projectName: string;
  /** owner/repo */
  slug: string;
  /** When true, surfaces management items linking back to the owner dashboard. */
  canAdmin?: boolean;
  /** Pulled from the page's `searchParams.from` server-side. */
  fromOrigin?: string | null;
  /** Optional signed-in user; null/undefined hides the user card. */
  user?: SidebarUserCardProps | null;
  /** Optional extra slot rendered above the user card (e.g. token mini-card). */
  footerSlot?: React.ReactNode;
  /** Override which item is highlighted; defaults to pathname matching. */
  activeKey?: string;
}

export function PublicProjectContextSidebar({
  projectId,
  projectName,
  slug,
  canAdmin = false,
  fromOrigin,
  user,
  footerSlot,
  activeKey,
}: PublicProjectContextSidebarProps) {
  const publicBase = `/r/${slug}`;
  const ownerBase = `/dashboard/projects/${projectId}`;

  const groups: ContextSidebarGroup[] = [
    {
      title: "Project",
      items: [
        { key: "leaderboard", label: "Leaderboard", icon: Trophy, href: publicBase },
        { key: "payouts", label: "Payouts", icon: Coins, href: `${publicBase}/payouts` },
        { key: "snapshots", label: "Snapshots", icon: History, href: `${publicBase}/snapshots` },
        { key: "repository", label: "Repository", icon: Github, href: `${publicBase}/repository` },
        { key: "token", label: "Token", icon: Sparkles, href: `${publicBase}/token` },
        { key: "docs", label: "Docs", icon: BookOpen, href: `${publicBase}/docs` },
      ],
    },
  ];

  if (canAdmin) {
    groups.push({
      title: "Manage",
      items: [
        { key: "owner-overview", label: "Owner dashboard", icon: Sparkles, href: ownerBase },
        { key: "owner-settings", label: "Settings", icon: Settings, href: `${ownerBase}/settings` },
        { key: "owner-api-keys", label: "API keys", icon: KeyRound, href: `${ownerBase}/api-keys` },
        { key: "owner-team", label: "Team", icon: Users, href: `${ownerBase}/team` },
      ],
    });
  }

  return (
    <ContextSidebar
      brand={{
        title: projectName,
        subtitle: slug,
        href: publicBase,
      }}
      groups={groups}
      fromOrigin={fromOrigin ?? "explore"}
      user={user ?? null}
      footerSlot={footerSlot}
      activeKey={activeKey}
    />
  );
}
