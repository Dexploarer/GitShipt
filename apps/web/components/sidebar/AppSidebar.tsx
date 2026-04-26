"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Coins,
  Compass,
  Eye,
  FileSearch,
  FileText,
  Flag,
  FlaskConical,
  FolderGit2,
  Github,
  History,
  Home,
  KeyRound,
  Plug,
  Power,
  Rocket,
  Settings,
  ShieldAlert,
  Sparkles,
  Trophy,
  Users,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
} from "@repo/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@repo/ui";
import { SidebarUserCard } from "./SidebarUserCard";
import { useSessionChrome } from "@/components/auth/SessionChromeProvider";
import { resolveOrigin } from "@/lib/nav/origins";
import { cn } from "@repo/lib";

/**
 * Single sidebar component for every surface in the app.
 *
 * Consumers pass only primitives + a `surface` discriminator. The sidebar
 * owns its full visual catalog (icons, nav structure, brand defaults, return-to
 * logic) internally — that's what keeps the server→client boundary clean
 * (server pages pass JSON-serializable props; the client sidebar resolves
 * them to React components on its own).
 *
 * Example mounts:
 *
 *   // Visitor on a public page
 *   <AppSidebar surface={{ kind: 'public' }} />
 *
 *   // Signed-in chrome is resolved from SessionChromeProvider / authStore.
 *   <AppSidebar surface={{ kind: 'public' }} />
 *
 *   // Signed-in user on /dashboard/projects/[id]/*
 *   <AppSidebar
 *     surface={{
 *       kind: 'owner-project',
 *       projectId, projectName, slug,
 *     }}
 *   />
 *
 *   // Anyone on /r/[org]/[repo]/*
 *   <AppSidebar
 *     surface={{
 *       kind: 'public-project',
 *       projectId, projectName, slug, canAdmin,
 *     }}
 *   />
 *
 *   // Signed-in admin on /admin/*
 *   <AppSidebar surface={{ kind: 'admin' }} />
 */

export type AppSidebarSurface =
  | { kind: "public" }
  | {
      kind: "owner-project";
      projectId: string;
      projectName: string;
      slug: string;
    }
  | {
      kind: "public-project";
      projectId: string;
      projectName: string;
      slug: string;
      canAdmin?: boolean;
    }
  | { kind: "admin" };

export interface AppSidebarProps {
  /** What chrome to render. Discriminated union — see examples above. */
  surface: AppSidebarSurface;
  /** Optional extra slot rendered in the footer above the user card. */
  footerSlot?: React.ReactNode;
  /** Override the active item by key match instead of pathname. */
  activeKey?: string;
}

interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  external?: boolean;
}
interface NavGroup {
  title?: string;
  items: NavItem[];
}

const LEGAL_LINKS = [
  { label: "Terms", href: "/legal/terms" },
  { label: "Privacy", href: "/legal/privacy" },
] as const;

// ─── Internal nav builders (client-side; icons imported above) ────────────

function publicGroup(): NavGroup {
  return {
    title: "Public",
    items: [
      { key: "home", label: "Home", icon: Home, href: "/" },
      { key: "explore", label: "Explore", icon: Compass, href: "/explore" },
      {
        key: "leaderboard",
        label: "Leaderboard",
        icon: Trophy,
        href: "/leaderboard",
      },
      { key: "launch", label: "Launch a token", icon: Rocket, href: "/launch" },
      { key: "docs", label: "Docs", icon: BookOpen, href: "/docs" },
    ],
  };
}

function accountGroup(): NavGroup {
  return {
    title: "Account",
    items: [
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
      {
        key: "wallets",
        label: "Wallets",
        icon: Wallet,
        href: "/dashboard/wallets",
      },
      {
        key: "api-keys",
        label: "API keys",
        icon: KeyRound,
        href: "/dashboard/api-keys",
      },
      {
        key: "security",
        label: "Security",
        icon: KeyRound,
        href: "/dashboard/security",
      },
    ],
  };
}

function getStartedGroup(): NavGroup {
  return {
    title: "Get started",
    items: [
      { key: "signin", label: "Sign in", icon: Github, href: "/auth/signin" },
      { key: "launch", label: "Launch a token", icon: Rocket, href: "/launch" },
    ],
  };
}

function platformShortcutGroup(): NavGroup {
  return {
    title: "Platform",
    items: [
      {
        key: "admin",
        label: "Admin console",
        icon: ShieldAlert,
        href: "/admin",
      },
    ],
  };
}

function ownerProjectGroups(projectId: string, slug: string): NavGroup[] {
  const base = `/dashboard/projects/${projectId}`;
  return [
    {
      title: "Project",
      items: [
        { key: "overview", label: "Overview", icon: Home, href: base },
        {
          key: "leaderboard",
          label: "Leaderboard",
          icon: Trophy,
          href: `${base}/leaderboard`,
        },
        {
          key: "scoring",
          label: "Scoring",
          icon: BarChart3,
          href: `${base}/scoring`,
        },
        {
          key: "payouts",
          label: "Payouts",
          icon: Coins,
          href: `${base}/payouts`,
        },
        {
          key: "repository",
          label: "Repository",
          icon: Github,
          href: `${base}/repository`,
        },
        { key: "token", label: "Token", icon: Sparkles, href: `${base}/token` },
      ],
    },
    {
      title: "Manage",
      items: [
        {
          key: "settings",
          label: "Settings",
          icon: Settings,
          href: `${base}/settings`,
        },
        {
          key: "api-keys",
          label: "API keys",
          icon: KeyRound,
          href: `${base}/api-keys`,
        },
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
        {
          key: "public-leaderboard",
          label: "Public leaderboard",
          icon: Eye,
          href: `/r/${slug}`,
        },
        {
          key: "public-payouts",
          label: "Public payouts",
          icon: Coins,
          href: `/r/${slug}/payouts`,
        },
        {
          key: "public-snapshots",
          label: "Snapshots ledger",
          icon: History,
          href: `/r/${slug}/snapshots`,
        },
        {
          key: "public-token",
          label: "Public token page",
          icon: Sparkles,
          href: `/r/${slug}/token`,
        },
        {
          key: "public-repository",
          label: "Public repo page",
          icon: Github,
          href: `/r/${slug}/repository`,
        },
      ],
    },
  ];
}

function publicProjectGroups(
  slug: string,
  projectId: string,
  canAdmin: boolean,
): NavGroup[] {
  const base = `/r/${slug}`;
  const groups: NavGroup[] = [
    {
      title: "Project",
      items: [
        { key: "leaderboard", label: "Leaderboard", icon: Trophy, href: base },
        {
          key: "payouts",
          label: "Payouts",
          icon: Coins,
          href: `${base}/payouts`,
        },
        {
          key: "snapshots",
          label: "Snapshots",
          icon: History,
          href: `${base}/snapshots`,
        },
        {
          key: "repository",
          label: "Repository",
          icon: Github,
          href: `${base}/repository`,
        },
        { key: "token", label: "Token", icon: Sparkles, href: `${base}/token` },
        { key: "docs", label: "Docs", icon: BookOpen, href: `${base}/docs` },
      ],
    },
  ];
  if (canAdmin) {
    const ownerBase = `/dashboard/projects/${projectId}`;
    groups.push({
      title: "Manage",
      items: [
        {
          key: "owner-overview",
          label: "Owner dashboard",
          icon: Sparkles,
          href: ownerBase,
        },
        {
          key: "owner-settings",
          label: "Settings",
          icon: Settings,
          href: `${ownerBase}/settings`,
        },
        {
          key: "owner-api-keys",
          label: "API keys",
          icon: KeyRound,
          href: `${ownerBase}/api-keys`,
        },
        {
          key: "owner-team",
          label: "Team",
          icon: Users,
          href: `${ownerBase}/team`,
        },
      ],
    });
  }
  return groups;
}

function adminGroups(): NavGroup[] {
  return [
    {
      title: "Ops",
      items: [
        { key: "overview", label: "Overview", icon: BarChart3, href: "/admin" },
        { key: "users", label: "Users", icon: Users, href: "/admin/users" },
        {
          key: "projects",
          label: "Projects",
          icon: FolderGit2,
          href: "/admin/projects",
        },
        {
          key: "payouts",
          label: "Payouts",
          icon: Coins,
          href: "/admin/payouts",
        },
        {
          key: "snapshots",
          label: "Snapshots",
          icon: History,
          href: "/admin/snapshots",
        },
      ],
    },
    {
      title: "Platform",
      items: [
        {
          key: "treasury",
          label: "Treasury",
          icon: Wallet,
          href: "/admin/treasury",
        },
        { key: "fees", label: "Fees", icon: Flag, href: "/admin/fees" },
        {
          key: "integrations",
          label: "Integrations",
          icon: Plug,
          href: "/admin/integrations",
        },
        {
          key: "feature-flags",
          label: "Feature flags",
          icon: FlaskConical,
          href: "/admin/feature-flags",
        },
        {
          key: "settings",
          label: "Settings",
          icon: Settings,
          href: "/admin/settings",
        },
      ],
    },
    {
      title: "Inspection",
      items: [
        {
          key: "workflows",
          label: "Workflows",
          icon: Workflow,
          href: "/admin/workflows",
        },
        {
          key: "audit",
          label: "Audit log",
          icon: FileSearch,
          href: "/admin/audit",
        },
        {
          key: "abuse",
          label: "Abuse review",
          icon: AlertTriangle,
          href: "/admin/abuse",
        },
        { key: "db", label: "DB sandbox", icon: FileText, href: "/admin/db" },
      ],
    },
    {
      title: "Maintenance",
      items: [
        {
          key: "maintenance",
          label: "Kill switch",
          icon: Power,
          href: "/admin/maintenance",
        },
      ],
    },
  ];
}

// ─── Surface → composition ────────────────────────────────────────────────

interface ResolvedComposition {
  brand: { title: string; subtitle?: string; href: string };
  returnTo: { label: string; href: string } | null;
  groups: NavGroup[];
}

function compose(
  surface: AppSidebarSurface,
  signedIn: boolean,
  isPlatformAdmin: boolean,
  fromOrigin: string | null,
): ResolvedComposition {
  switch (surface.kind) {
    case "public": {
      const groups: NavGroup[] = [publicGroup()];
      if (signedIn) groups.push(accountGroup());
      else groups.push(getStartedGroup());
      if (signedIn && isPlatformAdmin) groups.push(platformShortcutGroup());
      return {
        brand: { title: "GitBags", subtitle: "by SYMBiEX & dEXploarer", href: "/" },
        returnTo: null,
        groups,
      };
    }
    case "owner-project":
      return {
        brand: {
          title: surface.projectName,
          subtitle: surface.slug,
          href: "/dashboard",
        },
        returnTo: resolveOrigin(fromOrigin),
        groups: ownerProjectGroups(surface.projectId, surface.slug),
      };
    case "public-project":
      return {
        brand: {
          title: surface.projectName,
          subtitle: surface.slug,
          href: `/r/${surface.slug}`,
        },
        returnTo: resolveOrigin(fromOrigin),
        groups: publicProjectGroups(
          surface.slug,
          surface.projectId,
          Boolean(surface.canAdmin),
        ),
      };
    case "admin":
      return {
        brand: {
          title: "Admin console",
          subtitle: "GitBags platform",
          href: "/admin",
        },
        returnTo: resolveOrigin(fromOrigin),
        groups: adminGroups(),
      };
  }
}

// ─── The component ────────────────────────────────────────────────────────

export function AppSidebar({
  surface,
  footerSlot,
  activeKey,
}: AppSidebarProps) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const fromOrigin = searchParams?.get("from") ?? null;
  const chromeUser = useSessionChrome();
  const resolvedUser = chromeUser;
  const resolvedIsPlatformAdmin = Boolean(chromeUser?.isPlatformAdmin);

  const signedIn = Boolean(
    resolvedUser &&
    (resolvedUser.name ||
      resolvedUser.id ||
      resolvedUser.email ||
      resolvedUser.username ||
      resolvedUser.imageUrl),
  );
  const { brand, returnTo, groups } = compose(
    surface,
    signedIn,
    resolvedIsPlatformAdmin,
    fromOrigin,
  );

  const isItemActive = (href: string, key: string) => {
    if (activeKey !== undefined) return activeKey === key;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const isLegalActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href={brand.href} className="flex min-w-0 items-center">
          <CollapsibleBrand title={brand.title} subtitle={brand.subtitle} />
        </Link>
        <SidebarToggle className="ml-auto" />
      </SidebarHeader>

      <SidebarContent>
        {returnTo ? (
          <SidebarSection>
            <ReturnToLink href={returnTo.href} label={returnTo.label} />
          </SidebarSection>
        ) : null}

        {groups.map((group, gi) => (
          <React.Fragment key={`${group.title ?? "section"}-${gi}`}>
            {(returnTo || gi > 0) && <SidebarDivider />}
            <SidebarSection title={group.title}>
              {group.items.map((it) => (
                <SidebarItem
                  key={it.key}
                  icon={it.icon}
                  label={it.label}
                  href={it.href}
                  active={isItemActive(it.href, it.key)}
                  external={it.external}
                />
              ))}
            </SidebarSection>
          </React.Fragment>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <FooterLegalRow isActive={isLegalActive} />
        {footerSlot}
        {signedIn && resolvedUser ? (
          <SidebarUserCard
            id={resolvedUser.id ?? null}
            name={resolvedUser.name ?? null}
            email={resolvedUser.email ?? null}
            username={resolvedUser.username ?? null}
            imageUrl={resolvedUser.imageUrl ?? null}
          />
        ) : surface.kind === "public" ? (
          <CollapsibleSignInCta />
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <CollapsiblePoweredBy />
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function ReturnToLink({ href, label }: { href: string; label: string }) {
  const { collapsed, closeMobile } = useSidebar();
  return (
    <Link
      href={href}
      onClick={closeMobile}
      title={collapsed ? `Return to ${label}` : undefined}
      className={cn(
        "group flex h-9 items-center gap-3 rounded-md px-2.5",
        "text-fg-secondary transition-[background-color,color] duration-150",
        "hover:bg-surface-elevated/60 hover:text-fg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        collapsed && "lg:justify-center lg:px-0",
      )}
    >
      <ArrowLeft className="size-4 shrink-0" aria-hidden />
      <span className={cn("truncate text-label-md", collapsed && "lg:sr-only")}>
        Return to {label}
      </span>
    </Link>
  );
}

function FooterLegalRow({ isActive }: { isActive: (href: string) => boolean }) {
  const { collapsed } = useSidebar();
  if (collapsed) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-1 pb-1 text-caption text-fg-muted">
      {LEGAL_LINKS.map(({ label, href }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "transition-colors hover:text-fg",
            isActive(href) && "text-fg",
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

function CollapsibleSignInCta() {
  const { collapsed } = useSidebar();
  return (
    <Button
      asChild
      variant="primary"
      size="sm"
      className={cn("w-full", collapsed && "lg:hidden")}
    >
      <Link href="/auth/signin">
        <Github className="size-4" /> Sign in with GitHub
      </Link>
    </Button>
  );
}

function CollapsibleBrand({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { collapsed } = useSidebar();
  return (
    <span
      className={cn(
        "flex flex-col leading-tight min-w-0",
        collapsed && "lg:hidden",
      )}
    >
      <span className="text-label-md text-fg truncate">{title}</span>
      {subtitle ? (
        <span className="text-caption text-fg-muted truncate">{subtitle}</span>
      ) : null}
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
