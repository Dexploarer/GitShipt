import * as React from "react";
import Link from "next/link";
import { Github, Twitter } from "lucide-react";

/**
 * Shared dashboard shell — viewport-locked layout matching `/r/[org]/[repo]`:
 *   - Outer flex h-screen overflow-hidden.
 *   - Left: 12px gutter + sidebar (passed as prop).
 *   - Right: scrollable <main> + pinned glass footer.
 *
 * The sidebar is supplied so this component stays presentational; route
 * groups choose `<DashboardSidebar>` vs `<OwnedProjectSidebar>`.
 */
export function AppShell({
  sidebar,
  footerLeft,
  children,
}: {
  sidebar: React.ReactNode;
  /** Optional override for the footer left text. Defaults to brand. */
  footerLeft?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg text-fg">
      <div className="shrink-0 p-3 pr-0">{sidebar}</div>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-w-0 flex-1 overflow-y-auto px-4 pt-4 pb-3 lg:overflow-y-auto">
          {children}
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
            {footerLeft ?? "GitBags Console · devnet · BAGS.fm"}
          </span>
          <div className="flex items-center gap-1">
            <SocialLink href="https://github.com/" label="GitHub">
              <Github className="size-4" />
            </SocialLink>
            <SocialLink href="https://x.com/bagsdotfm" label="Bags on X">
              <Twitter className="size-4" />
            </SocialLink>
          </div>
        </footer>
      </div>
    </div>
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
