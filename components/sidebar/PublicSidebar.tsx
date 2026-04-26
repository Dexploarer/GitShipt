"use client";

import {
  BookOpen,
  Compass,
  FileText,
  Github,
  Home,
  LayoutDashboard,
  Rocket,
  Shield,
  ShieldAlert,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { SidebarUserCard } from "./SidebarUserCard";
import { cn } from "@/lib/utils";

/**
 * Public-facing sidebar — used on landing, /explore, /leaderboard, /docs,
 * /legal/*, /u/[username]. Pure navigation: Home / Explore / Leaderboard /
 * Docs at the top, Legal at the bottom. Sign-in CTA + ThemeToggle in the
 * footer when not signed in; SidebarUserCard when signed in.
 *
 * Composed from the same `Sidebar` primitive used everywhere else, so the
 * collapse + glass + macOS Tahoe depth all match the rest of the app.
 *
 * Active state derived from `usePathname()` — pass `active` only to
 * override (e.g., to highlight Home on a page that isn't /).
 */

const NAV = [
  { key: "home", label: "Home", icon: Home, href: "/" },
  { key: "explore", label: "Explore", icon: Compass, href: "/explore" },
  { key: "leaderboard", label: "Leaderboard", icon: Trophy, href: "/leaderboard" },
  { key: "docs", label: "Docs", icon: BookOpen, href: "/docs" },
] as const;

const LEGAL_NAV = [
  { key: "terms", label: "Terms", icon: FileText, href: "/legal/terms" },
  { key: "privacy", label: "Privacy", icon: Shield, href: "/legal/privacy" },
] as const;

export type PublicSidebarActive =
  | "home"
  | "explore"
  | "leaderboard"
  | "docs"
  | "terms"
  | "privacy"
  | undefined;

export interface PublicSidebarUser {
  name?: string | null;
  email?: string | null;
  username?: string | null;
  imageUrl?: string | null;
  /** Whether this user has admin/super_admin platform role. Reveals an Admin entry. */
  isPlatformAdmin?: boolean;
}

export interface PublicSidebarProps {
  active?: PublicSidebarActive;
  /** Pass `null` (or omit) when no session is present; an object when signed in. */
  user?: PublicSidebarUser | null;
}

export function PublicSidebar({ active, user }: PublicSidebarProps) {
  const pathname = usePathname() ?? "/";
  const isActive = (href: string, key: PublicSidebarActive) => {
    if (active !== undefined) return active === key;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

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
        <SidebarSection>
          {NAV.map(({ key, label, icon, href }) => (
            <SidebarItem
              key={key}
              icon={icon}
              label={label}
              href={href}
              active={isActive(href, key as PublicSidebarActive)}
            />
          ))}
        </SidebarSection>

        <SidebarSection title="Account">
          {signedIn ? (
            <>
              <SidebarItem
                icon={LayoutDashboard}
                label="Dashboard"
                href="/dashboard"
              />
              <SidebarItem
                icon={Rocket}
                label="Launch a token"
                href="/launch"
              />
              {user?.isPlatformAdmin ? (
                <SidebarItem
                  icon={ShieldAlert}
                  label="Admin console"
                  href="/admin"
                />
              ) : null}
            </>
          ) : (
            <>
              <SidebarItem
                icon={Github}
                label="Sign in"
                href="/auth/signin"
              />
              <SidebarItem
                icon={Rocket}
                label="Launch a token"
                href="/launch"
              />
            </>
          )}
        </SidebarSection>

        <SidebarSection title="Legal">
          {LEGAL_NAV.map(({ key, label, icon, href }) => (
            <SidebarItem
              key={key}
              icon={icon}
              label={label}
              href={href}
              active={isActive(href, key as PublicSidebarActive)}
            />
          ))}
        </SidebarSection>
      </SidebarContent>

      <SidebarFooter>
        {signedIn ? (
          <SidebarUserCard
            name={user?.name ?? null}
            email={user?.email ?? null}
            username={user?.username ?? null}
            imageUrl={user?.imageUrl ?? null}
          />
        ) : (
          <CollapsibleSignInCta />
        )}
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
