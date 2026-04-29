"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github, Menu, Sparkles, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@repo/lib";
import {
  Button,
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui";

/**
 * Top navigation for public surfaces (landing, /explore, /u/*, /docs, /legal/*).
 * Sticky, full-bleed, glassy backdrop. Contextual project pages keep the
 * floating sidebar instead — this is for non-contextual browse surfaces.
 *
 * Active state is derived from `usePathname()` by default; an `active` prop
 * lets a server page force the highlighted tab without a client read.
 */
export type PublicNavActive = "explore" | "leaderboard" | "docs" | undefined;

const NAV_LINKS: Array<{
  key: NonNullable<PublicNavActive>;
  href: string;
  label: string;
}> = [
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
        <Link href="/" className="flex min-h-11 min-w-0 items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-fg">
            <Sparkles className="size-4" />
          </span>
          <span className="min-w-0 truncate text-headline-sm">
            GitShipt
            <span className="ml-2 hidden text-label-sm font-normal text-fg-muted sm:inline">
              by SYMBiEX & dEXploarer
            </span>
          </span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map(({ key, href, label }) => {
            const on = isActive(key, href);
            return (
              <Link
                key={key}
                href={href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "rounded-md border px-3 py-2 text-label-md transition-[background-color,border-color,box-shadow,color,transform]",
                  on
                    ? "gb-control gb-control-secondary border-border-strong bg-surface-elevated text-fg"
                    : "gb-route-link gb-route-link-inactive text-fg-secondary hover:text-fg",
                )}
              >
                {label}
              </Link>
            );
          })}
          <ThemeToggle className="ml-1" />
          <Link
            href="/auth/signin"
            className="gb-control gb-control-primary ml-2 inline-flex h-9 items-center gap-2 rounded-md border border-primary bg-primary px-4 text-label-md text-primary-fg"
          >
            <Github className="size-4" />
            Sign in
          </Link>
        </nav>
        <div className="flex items-center gap-2 lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Open navigation"
                className="size-11"
              >
                <Menu aria-hidden className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              showCloseButton={false}
              className="w-80 max-w-[calc(100vw-2rem)] gap-0 p-0"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex min-h-16 items-center justify-between border-b border-border px-4">
                <SheetClose asChild>
                  <Link
                    href="/"
                    className="flex min-h-11 min-w-0 items-center gap-3"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-fg">
                      <Sparkles aria-hidden className="size-4" />
                    </span>
                    <span className="truncate text-headline-sm">GitShipt</span>
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <button
                    type="button"
                    aria-label="Close navigation"
                    className={cn(
                      "gb-control gb-control-icon gb-control-ghost inline-flex size-11 items-center justify-center rounded-md",
                      "text-fg-secondary hover:text-fg",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                    )}
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </SheetClose>
              </div>
              <nav aria-label="Mobile" className="flex flex-col gap-1 p-4">
                {NAV_LINKS.map(({ key, href, label }) => {
                  const on = isActive(key, href);
                  return (
                    <SheetClose key={key} asChild>
                      <Link
                        href={href}
                        aria-current={on ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center rounded-md border px-3 text-label-md transition-[background-color,border-color,box-shadow,color]",
                          on
                            ? "gb-control gb-control-secondary border-border-strong bg-surface-elevated text-fg"
                            : "gb-route-link gb-route-link-inactive text-fg-secondary hover:text-fg",
                        )}
                      >
                        {label}
                      </Link>
                    </SheetClose>
                  );
                })}
              </nav>
              <div className="mt-auto flex flex-col gap-3 border-t border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-label-md text-fg-secondary">Theme</span>
                  <ThemeToggle />
                </div>
                <SheetClose asChild>
                  <Link
                    href="/auth/signin"
                    className="gb-control gb-control-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-primary bg-primary px-4 text-label-md text-primary-fg"
                  >
                    <Github aria-hidden className="size-4" />
                    Sign in
                  </Link>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
