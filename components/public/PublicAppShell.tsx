import Link from "next/link";
import { Github, Twitter } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  PublicSidebar,
  type PublicSidebarActive,
} from "@/components/sidebar/PublicSidebar";

/**
 * PublicAppShell — viewport-locked app shell for public pages, mirroring
 * `ProjectShell` but using `PublicSidebar` instead of the project-scoped
 * one. Use this on landing / explore / leaderboard / docs / legal / etc.
 *
 *   - Outer flex h-screen overflow-hidden (page never scrolls; only main does)
 *   - Sidebar in a 12px outer gutter (top/left/bottom)
 *   - Content area scrolls internally; footer pinned bottom-right with
 *     rounded-tl, social icons, "devnet · BAGS.fm" caption
 */
export function PublicAppShell({
  active,
  footerLeft = "devnet · BAGS.fm",
  children,
}: {
  active?: PublicSidebarActive;
  footerLeft?: string;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-bg text-fg">
        <div className="shrink-0 p-3 pr-0">
          <PublicSidebar active={active} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="min-w-0 flex-1 overflow-y-auto px-4 pt-4 pb-3">
            <div className="mx-auto w-full max-w-content">{children}</div>
          </main>

          <footer
            className={[
              "shrink-0 ml-3",
              "rounded-tl-2xl",
              "border-t border-l border-border/60",
              "glass shadow-card-elevated surface-highlight",
              "flex items-center justify-between gap-3",
              "px-4 py-1.5",
            ].join(" ")}
          >
            <span className="truncate text-caption text-fg-muted">
              {footerLeft}
            </span>
            <div className="flex items-center gap-1">
              <SocialLink
                href="https://github.com/SYMBaiEX/gitbags"
                label="GitBags repo"
              >
                <Github className="size-4" />
              </SocialLink>
              <SocialLink href="https://x.com/bagsdotfm" label="Bags on X">
                <Twitter className="size-4" />
              </SocialLink>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      className="inline-flex size-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-elevated hover:text-fg"
    >
      {children}
    </Link>
  );
}
