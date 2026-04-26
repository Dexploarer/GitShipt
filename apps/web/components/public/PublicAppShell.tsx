import Link from "next/link";
import { Github, Twitter } from "lucide-react";
import { SidebarProvider } from "@repo/ui";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { MobileSidebarTrigger } from "@/components/sidebar/MobileSidebarTrigger";

/**
 * PublicAppShell — viewport-locked app shell for public pages (landing,
 * /explore, /leaderboard, /docs, /legal, /u/[username]).
 *
 * Mounts the unified `<AppSidebar>` with public nav. Signed-in chrome comes
 * from the root SessionChromeProvider so logout updates every shell at once.
 *
 * Layout: outer flex h-screen. Sidebar inline on lg+ (12px gutter), fixed
 * slide-over below lg. Footer pinned bottom-right with social icons.
 */

// Re-export for legacy callers; pathname matching now covers active state
// so callers can stop passing `active` if they want to.
export type PublicSidebarActive = string | undefined;

export function PublicAppShell({
  footerLeft = "devnet · BAGS.fm",
  defaultSidebarCollapsed = false,
  children,
}: {
  /** Deprecated — pathname matching handles active state. Kept for back-compat. */
  active?: PublicSidebarActive;
  footerLeft?: string;
  defaultSidebarCollapsed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultCollapsed={defaultSidebarCollapsed}>
      <div className="flex h-screen overflow-hidden bg-app-gradient text-fg">
        <div className="contents lg:block lg:shrink-0 lg:p-3 lg:pr-0">
          <AppSidebar surface={{ kind: "public" }} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="min-w-0 flex-1 overflow-y-auto bg-app-gradient px-4 pt-4 pb-3 lg:px-10">
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
