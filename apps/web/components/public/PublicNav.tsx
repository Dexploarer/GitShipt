"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@repo/lib";

/**
 * Top navigation for public surfaces (landing, /explore, /u/*, /docs, /legal/*).
 * Sticky, full-bleed, glassy backdrop. Contextual project pages keep the
 * floating sidebar instead — this is for non-contextual browse surfaces.
 *
 * Active state is derived from `usePathname()` by default; an `active` prop
 * lets a server page force the highlighted tab without a client read.
 */
export type PublicNavActive = "explore" | "leaderboard" | "docs" | undefined;

const NAV_LINKS: Array<{ key: NonNullable<PublicNavActive>; href: string; label: string }> = [
  { key: "explore", href: "/explore", label: "Explore" },
  { key: "leaderboard", href: "/leaderboard", label: "Leaderboard" },
  { key: "docs", href: "/docs", label: "Docs" },
];

export function PublicNav({ active }: { active?: PublicNavActive }) {
  const pathname = usePathname();

  function isActive(key: NonNullable<PublicNavActive>, href: string): boolean {
    if (active) return active === key;
    if (!pathname) return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-content items-center justify-between px-margin">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-bg">
            <Sparkles className="size-4" />
          </span>
          <span className="text-headline-sm tracking-tight">
            GitBags
            <span className="ml-2 text-label-sm font-normal text-fg-muted">
              by SYMBiEX & dEXploarer
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV_LINKS.map(({ key, href, label }) => {
            const on = isActive(key, href);
            return (
              <Link
                key={key}
                href={href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-label-md transition-colors",
                  on
                    ? "bg-surface-elevated text-fg"
                    : "text-fg-secondary hover:bg-surface-elevated hover:text-fg",
                )}
              >
                {label}
              </Link>
            );
          })}
          <ThemeToggle className="ml-1" />
          <Link
            href="/auth/signin"
            className="ml-2 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-label-md text-fg transition-colors hover:bg-primary-hover"
          >
            <Github className="size-4" />
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
