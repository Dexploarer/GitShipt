import Link from "next/link";
import { Github, Twitter } from "lucide-react";
import { ProjectSidebar } from "@/components/sidebar/ProjectSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { MobileSidebarTrigger } from "@/components/sidebar/MobileSidebarTrigger";
import type { SidebarUserCardProps } from "@/components/sidebar/SidebarUserCard";
import type { ProjectHeader, PoolOverview } from "@/lib/queries/project-page";

/**
 * ProjectShell — shared app shell for every page under /r/[org]/[repo]/*.
 *
 * Composes:
 *   - SidebarProvider (collapse + mobile drawer state)
 *   - Outer flex h-screen container (viewport-locked)
 *   - ProjectSidebar (with `active` key for nav highlight, canAdmin gating,
 *     and the standard token + wallet footer cards)
 *   - <main> with overflow-y-auto on lg+ via the consumer's choice
 *   - MobileSidebarTrigger pinned to the top of <main> on < lg
 *   - <footer> anchored bottom-right with rounded-tl, GitHub/Twitter social
 *
 * Pages just pass `header`, `pool`, `active`, and `children`. The chrome
 * stays consistent across Leaderboard / Payouts / Snapshots / Repository
 * / Token / Docs.
 */
export interface ProjectShellProps {
  header: ProjectHeader;
  pool: PoolOverview;
  active: ProjectSidebarActive;
  canAdmin?: boolean;
  /** Signed-in user — surfaces the SidebarUserCard in the footer. */
  user?: SidebarUserCardProps | null;
  /**
   * Whether <main> should overflow-hidden on lg (true for the leaderboard
   * page where the bento grid fits the viewport) or overflow-y-auto on
   * all sizes (default — for sub-routes that may have long tables).
   */
  fitViewport?: boolean;
  children: React.ReactNode;
}

type ProjectSidebarActive =
  | "leaderboard"
  | "payouts"
  | "snapshots"
  | "repository"
  | "token"
  | "settings"
  | "api-keys"
  | "team"
  | "docs";

export function ProjectShell({
  header,
  pool,
  active,
  canAdmin = false,
  user,
  fitViewport = false,
  children,
}: ProjectShellProps) {
  const slug = `${header.ghOwner}/${header.ghRepo}`;
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-bg text-fg">
        <div className="contents lg:block lg:shrink-0 lg:p-3 lg:pr-0">
          <ProjectSidebar
            slug={slug}
            projectId={header.id}
            active={active}
            canAdmin={canAdmin}
            token={{ header, pool }}
            wallet={{}}
            user={user}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <main
            className={
              fitViewport
                ? "min-w-0 flex-1 overflow-y-auto px-4 pt-4 pb-3 lg:overflow-hidden"
                : "min-w-0 flex-1 overflow-y-auto px-4 pt-4 pb-3"
            }
          >
            <div className="mb-3 lg:hidden">
              <MobileSidebarTrigger />
            </div>
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
              {slug} · devnet · BAGS.fm
            </span>
            <div className="flex items-center gap-1">
              <SocialLink
                href={`https://github.com/${header.ghOwner}/${header.ghRepo}`}
                label="GitHub repo"
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

export type { ProjectSidebarActive };
