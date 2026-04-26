import Link from "next/link";
import { Github, Twitter } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  PublicSidebar,
  type PublicSidebarActive,
  type PublicSidebarUser,
} from "@/components/sidebar/PublicSidebar";
import { MobileSidebarTrigger } from "@/components/sidebar/MobileSidebarTrigger";

/**
 * PublicAppShell — viewport-locked app shell for public pages, mirroring
 * `ProjectShell` but using `PublicSidebar` instead of the project-scoped
 * one. Use this on landing / explore / leaderboard / docs / legal / etc.
 *
 *   - Outer flex h-screen overflow-hidden (page never scrolls; only main does)
 *   - Sidebar: inline column on lg+ (12px outer gutter), slide-over drawer
 *     below lg. The hamburger lives at the top of <main>.
 *   - Footer pinned bottom-right with rounded-tl, social icons.
 */
export function PublicAppShell({
  active,
  footerLeft = "devnet · BAGS.fm",
  user,
  children,
}: {
  active?: PublicSidebarActive;
  footerLeft?: string;
  /** Pass `null` for signed-out, an object when signed in. */
  user?: PublicSidebarUser | null;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-bg text-fg">
        {/* Sidebar — inline on lg+ (with 12px outer gutter), fixed slide-over
            drawer on < lg (positioned by the Sidebar primitive). The wrapper
            collapses to zero width below lg so content reflows full-width. */}
        <div className="shrink-0 lg:p-3 lg:pr-0">
          <PublicSidebar active={active} user={user} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="min-w-0 flex-1 overflow-y-auto px-4 pt-4 pb-3">
            <div className="mx-auto w-full max-w-content">
              <div className="mb-3 lg:hidden">
                <MobileSidebarTrigger />
              </div>
              {children}
            </div>
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
