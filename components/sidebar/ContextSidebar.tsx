"use client";

import * as React from "react";
import { ArrowLeft, type LucideIcon } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarUserCard, type SidebarUserCardProps } from "./SidebarUserCard";
import { signOutAction } from "./sign-out-action";
import { resolveOrigin } from "@/lib/nav/origins";
import { cn } from "@/lib/utils";

/**
 * Sidebar for "drill-in" views — single-project pages, admin pages, any
 * route where the user navigated INTO a focused context from somewhere
 * else and needs a clear way back.
 *
 * Header: a "← Return to {origin}" link that uses the `?from=<origin>`
 * search param convention (see `lib/nav/origins.ts`). Defaults to
 * "Return to Explore" when no `from` param is present.
 *
 * Body: a fully-typed nav configuration (`groups`) that callers supply.
 * Each group is a section with a title + items; `active` is matched
 * against `pathname` (or an explicit `activeKey` prop).
 *
 * Footer: optional user card + sign-out + theme toggle. Callers that want
 * a public-only context (e.g. the public project page for a visitor) can
 * pass `user={null}` and the user surface is hidden.
 */

export interface ContextSidebarItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  /** Pass a node (e.g., a `<Badge>`) to render at the right edge of the item. */
  badge?: React.ReactNode;
  /** Hide the item entirely (e.g., admin-gated). */
  show?: boolean;
  /** Open in new tab. */
  external?: boolean;
}

export interface ContextSidebarGroup {
  /** Section title; omit for an untitled section. */
  title?: string;
  items: ContextSidebarItem[];
}

export interface ContextSidebarBrand {
  /** Two-line lockup at the top: title + subtitle. */
  title: string;
  subtitle?: string;
  /** Where the brand link goes (typically /dashboard or /). */
  href: string;
}

export interface ContextSidebarProps {
  /** What this sidebar represents — shown as the header brand. */
  brand: ContextSidebarBrand;
  /** Navigation groups rendered in order. */
  groups: ContextSidebarGroup[];
  /**
   * Optional override for the `?from=<origin>` value. When omitted, the
   * sidebar reads it from `useSearchParams()` itself — most consumers
   * should let it auto-detect. Server-side callers that have already
   * resolved the origin (e.g. for SSR rendering) can still pass it.
   */
  fromOrigin?: string | null;
  /** Optional user card in the footer. Pass null/undefined to hide it. */
  user?: SidebarUserCardProps | null;
  /** Override the resolved active item via key match instead of pathname. */
  activeKey?: string;
  /** Optional extra slot rendered above the user card (e.g. token mini-card). */
  footerSlot?: React.ReactNode;
}

export function ContextSidebar({
  brand,
  groups,
  fromOrigin,
  user,
  activeKey,
  footerSlot,
}: ContextSidebarProps) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const resolvedFrom =
    fromOrigin !== undefined ? fromOrigin : searchParams?.get("from") ?? null;
  const origin = resolveOrigin(resolvedFrom);
  const signedIn = Boolean(user && (user.name || user.email));

  const isActive = (item: ContextSidebarItem) => {
    if (activeKey !== undefined) return item.key === activeKey;
    if (item.href === "/") return pathname === "/";
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href={brand.href} className="flex min-w-0 items-center">
          <CollapsibleBrand title={brand.title} subtitle={brand.subtitle} />
        </Link>
        <SidebarToggle className="ml-auto" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarSection>
          <ReturnToLink href={origin.href} label={origin.label} />
        </SidebarSection>

        {groups.map((group, gi) => (
          <React.Fragment key={`${group.title ?? "section"}-${gi}`}>
            <SidebarDivider />
            <SidebarSection title={group.title}>
              {group.items
                .filter((it) => it.show !== false)
                .map((it) => (
                  <SidebarItem
                    key={it.key}
                    icon={it.icon}
                    label={it.label}
                    href={it.href}
                    active={isActive(it)}
                    badge={it.badge}
                    external={it.external}
                  />
                ))}
            </SidebarSection>
          </React.Fragment>
        ))}
      </SidebarContent>

      <SidebarFooter>
        {footerSlot}
        {signedIn && user ? (
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
      <span
        className={cn(
          "truncate text-label-md",
          collapsed && "lg:sr-only",
        )}
      >
        Return to {label}
      </span>
    </Link>
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
        <span
          className={cn("truncate text-label-md", collapsed && "lg:sr-only")}
        >
          Sign out
        </span>
      </button>
    </form>
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
