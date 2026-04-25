import Link from "next/link";
import {
  BookOpen,
  Coins,
  Github,
  Home,
  Key,
  Settings,
  Sparkles,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TokenSparkCard } from "./TokenSparkCard";
import { UserWalletCard } from "./UserWalletCard";
import type { ProjectHeader } from "@/lib/queries/project-page";
import type { PoolOverview } from "@/lib/queries/project-page";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  active?: boolean;
  adminOnly?: boolean;
};

/**
 * Project context sidebar. Renders next to the main content; the rest of the
 * page is content-area. The Settings/API Keys items are admin-only and stay
 * hidden until parent passes `canAdmin`. Day 2 always passes false; the
 * dashboard layer will flip it on for owners.
 */
export function ProjectSidebar({
  header,
  pool,
  canAdmin = false,
}: {
  header: ProjectHeader;
  pool: PoolOverview;
  canAdmin?: boolean;
}) {
  const items: NavItem[] = [
    { href: `/r/${header.slug}`, label: "Overview", icon: Home },
    {
      href: `/r/${header.slug}`,
      label: "Leaderboard",
      icon: Trophy,
      active: true,
    },
    { href: `/r/${header.slug}/payouts`, label: "Payouts", icon: Coins },
    {
      href: `https://github.com/${header.ghOwner}/${header.ghRepo}`,
      label: "Repository",
      icon: Github,
    },
    { href: `/r/${header.slug}/token`, label: "Token", icon: Sparkles },
    {
      href: `/r/${header.slug}/settings`,
      label: "Settings",
      icon: Settings,
      adminOnly: true,
    },
    {
      href: `/r/${header.slug}/api-keys`,
      label: "API Keys",
      icon: Key,
      adminOnly: true,
    },
    { href: "/docs", label: "Docs", icon: BookOpen },
  ];

  const visibleItems = items.filter((i) => (i.adminOnly ? canAdmin : true));

  return (
    <aside
      className="sticky top-0 flex h-screen w-sidebar shrink-0 flex-col border-r border-border bg-bg"
      data-can-admin={canAdmin ? "true" : "false"}
    >
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="grid size-8 place-items-center rounded-md bg-primary text-bg">
          <Sparkles className="size-4" />
        </span>
        <span className="text-headline-sm tracking-tight text-fg">
          GitBags
          <span className="ml-2 text-label-sm font-normal text-fg-muted">
            by BAGS.fm
          </span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isExternal = item.href.startsWith("http");
            const className = cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-label-md transition-colors",
              item.active
                ? "bg-surface-elevated text-fg"
                : "text-fg-secondary hover:bg-surface hover:text-fg",
            );
            return (
              <li key={`${item.label}-${item.href}`}>
                {isExternal ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={className}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </a>
                ) : (
                  <Link href={item.href} className={className}>
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-3 px-4 pb-4">
        <TokenSparkCard header={header} pool={pool} />
        <UserWalletCard />
      </div>

      <div className="border-t border-border px-4 py-3 text-caption text-fg-muted">
        Powered by BAGS.fm API
      </div>
    </aside>
  );
}
