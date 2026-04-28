import Link from "next/link";
import { Github, Twitter } from "lucide-react";
import { SidebarProvider } from "@repo/ui";
import type { ProjectHeader } from "@/lib/queries/project-page";
import { ProjectShellMain, ProjectShellSidebar } from "./ProjectShellClient";
import { clusterLabel } from "@/lib/solana/explorer";

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
  active?: ProjectSidebarActive;
  canAdmin?: boolean;
  defaultSidebarCollapsed?: boolean;
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
  active,
  canAdmin = false,
  defaultSidebarCollapsed = false,
  fitViewport,
  children,
}: ProjectShellProps) {
  const slug = `${header.ghOwner}/${header.ghRepo}`;
  return (
    <SidebarProvider defaultCollapsed={defaultSidebarCollapsed}>
      <div className="flex h-screen overflow-hidden bg-bg text-fg">
        <div className="contents lg:block lg:shrink-0 lg:p-3 lg:pr-0">
          <ProjectShellSidebar
            surface={{
              kind: "public-project",
              projectId: header.id,
              projectName: header.name,
              slug,
              canAdmin,
            }}
            active={active}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <ProjectShellMain active={active} fitViewport={fitViewport}>
            {children}
          </ProjectShellMain>

          <footer
            className={[
              "shrink-0 ml-3",
              "rounded-tl-2xl",
              "border-t border-l border-border/60",
              "glass shadow-card-elevated surface-highlight",
              "flex items-center justify-between gap-3",
              "px-4 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] lg:py-1.5",
            ].join(" ")}
          >
            <span className="truncate text-caption text-fg-muted">
              {slug} · {clusterLabel()} · BAGS.fm
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
      className="gb-control gb-control-icon gb-control-ghost inline-flex size-7 items-center justify-center rounded-md text-fg-muted hover:text-fg"
    >
      {children}
    </Link>
  );
}

export type { ProjectSidebarActive };
