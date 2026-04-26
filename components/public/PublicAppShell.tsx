import Link from "next/link";
import { Github, Twitter } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { UnauthSidebar, type UnauthSidebarActive } from "@/components/sidebar/UnauthSidebar";
import { AuthSidebar } from "@/components/sidebar/AuthSidebar";
import { MobileSidebarTrigger } from "@/components/sidebar/MobileSidebarTrigger";

/**
 * PublicAppShell — viewport-locked app shell for public pages (landing,
 * /explore, /leaderboard, /docs, /legal, /u/[username]).
 *
 * Switches sidebar based on session:
 *   - No user → `<UnauthSidebar>` (visitor nav + Sign-in CTA)
 *   - Signed in → `<AuthSidebar publicChrome>` (account links surface so
 *     the user can hop to /dashboard from anywhere)
 *
 * Layout: outer flex h-screen overflow-hidden. Sidebar is inline on lg+
 * (12px outer gutter) and a fixed slide-over drawer below lg. Footer is
 * pinned bottom-right with social icons.
 */

export type PublicSidebarActive = UnauthSidebarActive;

export interface PublicAppShellUser {
  name?: string | null;
  email?: string | null;
  username?: string | null;
  imageUrl?: string | null;
  /** Whether this user has the platform admin/super_admin role. */
  isPlatformAdmin?: boolean;
}

export function PublicAppShell({
  active,
  footerLeft = "devnet · BAGS.fm",
  user,
  children,
}: {
  active?: PublicSidebarActive;
  footerLeft?: string;
  /** Pass `null` for signed-out, an object when signed in. */
  user?: PublicAppShellUser | null;
  children: React.ReactNode;
}) {
  const signedIn = Boolean(user && (user.name || user.email));

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-app-gradient text-fg">
        {/* Sidebar — inline on lg+ (12px gutter), fixed slide-over below lg.
            Wrapper collapses to zero width below lg via `display: contents`. */}
        <div className="contents lg:block lg:shrink-0 lg:p-3 lg:pr-0">
          {signedIn && user ? (
            <AuthSidebar
              publicChrome
              user={{
                name: user.name ?? null,
                email: user.email ?? null,
                username: user.username ?? null,
                imageUrl: user.imageUrl ?? null,
              }}
              isPlatformAdmin={user.isPlatformAdmin ?? false}
            />
          ) : (
            <UnauthSidebar active={active} />
          )}
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
