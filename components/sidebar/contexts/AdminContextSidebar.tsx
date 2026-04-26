"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Coins,
  FileSearch,
  FileText,
  FlaskConical,
  Flag,
  FolderGit2,
  History,
  Plug,
  Power,
  Shield,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import {
  ContextSidebar,
  type ContextSidebarGroup,
} from "../ContextSidebar";
import type { SidebarUserCardProps } from "../SidebarUserCard";

/**
 * Sidebar for the platform admin console. Mounted by `app/admin/layout.tsx`.
 *
 * Header: "Admin console". Body: ops nav (overview / projects / payouts /
 * snapshots / treasury / fees / workflows / audit) + a maintenance group
 * for the irreversible levers.
 *
 * Defaults the "← Return to" link to `/dashboard` (the only place an admin
 * would click into the admin console from); honors `?from=...` when present.
 */
export interface AdminContextSidebarProps {
  user: SidebarUserCardProps;
  fromOrigin?: string | null;
}

const OPS: ContextSidebarGroup = {
  title: "Ops",
  items: [
    { key: "overview", label: "Overview", icon: BarChart3, href: "/admin" },
    { key: "users", label: "Users", icon: Users, href: "/admin/users" },
    { key: "projects", label: "Projects", icon: FolderGit2, href: "/admin/projects" },
    { key: "payouts", label: "Payouts", icon: Coins, href: "/admin/payouts" },
    { key: "snapshots", label: "Snapshots", icon: History, href: "/admin/snapshots" },
  ],
};

const PLATFORM: ContextSidebarGroup = {
  title: "Platform",
  items: [
    { key: "treasury", label: "Treasury", icon: Wallet, href: "/admin/treasury" },
    { key: "fees", label: "Fees", icon: Flag, href: "/admin/fees" },
    { key: "integrations", label: "Integrations", icon: Plug, href: "/admin/integrations" },
    { key: "feature-flags", label: "Feature flags", icon: FlaskConical, href: "/admin/feature-flags" },
  ],
};

const INSPECTION: ContextSidebarGroup = {
  title: "Inspection",
  items: [
    { key: "workflows", label: "Workflows", icon: Workflow, href: "/admin/workflows" },
    { key: "audit", label: "Audit log", icon: FileSearch, href: "/admin/audit" },
    { key: "abuse", label: "Abuse review", icon: AlertTriangle, href: "/admin/abuse" },
    { key: "db", label: "DB sandbox", icon: FileText, href: "/admin/db" },
    { key: "activity", label: "Activity", icon: Activity, href: "/admin/activity" },
  ],
};

const MAINTENANCE: ContextSidebarGroup = {
  title: "Maintenance",
  items: [
    { key: "maintenance", label: "Kill switch", icon: Power, href: "/admin/maintenance" },
  ],
};

export function AdminContextSidebar({ user, fromOrigin }: AdminContextSidebarProps) {
  return (
    <ContextSidebar
      brand={{
        title: "Admin console",
        subtitle: "GitBags platform",
        href: "/admin",
      }}
      groups={[OPS, PLATFORM, INSPECTION, MAINTENANCE]}
      fromOrigin={fromOrigin ?? "dashboard"}
      user={user}
    />
  );
}
