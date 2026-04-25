"use client";

import {
  BookOpen,
  Compass,
  FileText,
  Github,
  Home,
  Rocket,
  Shield,
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

/**
 * Public-facing sidebar — used on landing, /explore, /leaderboard, /docs,
 * /legal/*, /u/[username]. Pure navigation: Home / Explore / Leaderboard /
 * Docs at the top, Legal at the bottom. Sign-in CTA + ThemeToggle in the
 * footer when not signed in.
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

export function PublicSidebar({ active }: { active?: PublicSidebarActive }) {
  const pathname = usePathname() ?? "/";
  const isActive = (href: string, key: PublicSidebarActive) => {
    if (active !== undefined) return active === key;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

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
        <CollapsibleSignInCta />
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

function CollapsibleSignInCta() {
  const { collapsed } = useSidebar();
  if (collapsed) return null;
  return (
    <Button asChild variant="primary" size="sm" className="w-full">
      <Link href="/auth/signin">
        <Github className="size-4" /> Sign in with GitHub
      </Link>
    </Button>
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
