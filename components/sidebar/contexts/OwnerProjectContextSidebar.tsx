"use client";

import {
  BookOpen,
  Coins,
  Eye,
  Github,
  History,
  Home,
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
 * Sidebar for an owner editing one of their projects (every page under
 * `/dashboard/projects/[id]/*`).
 *
 * Header: project name + slug. Body: Owner nav (Overview / Leaderboard /
 * Payouts / Repository / Token / Settings / API keys / Team / Docs) plus
 * a "Public view" group linking out to the visitor surface.
 *
 * Returns to whichever origin the user came from (`?from=...`); defaults
 * to `/dashboard/projects` when missing.
 */
export interface OwnerProjectContextSidebarProps {
  projectId: string;
  projectName: string;
  /** owner/repo, used for the public links. */
  slug: string;
  /** Pulled from the page's `searchParams.from` server-side. */
  fromOrigin?: string | null;
  /** Optional — when provided, renders the user card + sign-out in the footer. */
  user?: SidebarUserCardProps | null;
}

export function OwnerProjectContextSidebar({
  projectId,
  projectName,
  slug,
  fromOrigin,
  user,
}: OwnerProjectContextSidebarProps) {
  const base = `/dashboard/projects/${projectId}`;

  const groups: ContextSidebarGroup[] = [
    {
      title: "Project",
      items: [
        { key: "overview", label: "Overview", icon: Home, href: base },
        { key: "leaderboard", label: "Leaderboard", icon: Trophy, href: `${base}/leaderboard` },
        { key: "payouts", label: "Payouts", icon: Coins, href: `${base}/payouts` },
        { key: "repository", label: "Repository", icon: Github, href: `${base}/repository` },
        { key: "token", label: "Token", icon: Sparkles, href: `${base}/token` },
      ],
    },
    {
      title: "Admin",
      items: [
        { key: "settings", label: "Settings", icon: Settings, href: `${base}/settings` },
        { key: "api-keys", label: "API keys", icon: KeyRound, href: `${base}/api-keys` },
        { key: "team", label: "Team", icon: Users, href: `${base}/team` },
      ],
    },
    {
      title: "Resources",
      items: [
        { key: "docs", label: "Docs", icon: BookOpen, href: `${base}/docs` },
      ],
    },
    {
      title: "Public view",
      items: [
        { key: "public-leaderboard", label: "Public leaderboard", icon: Eye, href: `/r/${slug}` },
        { key: "public-payouts", label: "Public payouts", icon: Coins, href: `/r/${slug}/payouts` },
        { key: "public-snapshots", label: "Snapshots ledger", icon: History, href: `/r/${slug}/snapshots` },
        { key: "public-token", label: "Public token page", icon: Sparkles, href: `/r/${slug}/token` },
        { key: "public-repository", label: "Public repo page", icon: Github, href: `/r/${slug}/repository` },
      ],
    },
  ];

  return (
    <ContextSidebar
      brand={{
        title: projectName,
        subtitle: slug,
        href: "/dashboard",
      }}
      groups={groups}
      fromOrigin={fromOrigin ?? "dashboard.projects"}
      user={user ?? null}
    />
  );
}
