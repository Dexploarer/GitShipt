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
import { cn } from "@/lib/utils";

/**
 * Sidebar for visitors that aren't signed in.
 *
 * Mounted by `<PublicAppShell user={null} />` on every public page when
 * the session lookup yields nothing. Pure navigation + Sign-in CTA;
 * intentionally short — there's no "Account" surface to expose.
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

export type UnauthSidebarActive =
  | "home"
  | "explore"
  | "leaderboard"
  | "docs"
  | "terms"
  | "privacy"
  | undefined;

export interface UnauthSidebarProps {
  active?: UnauthSidebarActive;
}

export function UnauthSidebar({ active }: UnauthSidebarProps) {
  const pathname = usePathname() ?? "/";
  const isActive = (href: string, key: UnauthSidebarActive) => {
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
              active={isActive(href, key as UnauthSidebarActive)}
            />
          ))}
        </SidebarSection>

        <SidebarSection title="Get started">
          <SidebarItem icon={Github} label="Sign in" href="/auth/signin" />
          <SidebarItem icon={Rocket} label="Launch a token" href="/launch" />
        </SidebarSection>

        <SidebarSection title="Legal">
          {LEGAL_NAV.map(({ key, label, icon, href }) => (
            <SidebarItem
              key={key}
              icon={icon}
              label={label}
              href={href}
              active={isActive(href, key as UnauthSidebarActive)}
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
