import { notFound } from "next/navigation";
import Link from "next/link";
import { Github, Twitter } from "lucide-react";
import { hasCredentials } from "@/lib/env";
import { requireAuthSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { SidebarProvider } from "@repo/ui";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { MobileSidebarTrigger } from "@/components/sidebar/MobileSidebarTrigger";
import { getDefaultSidebarCollapsed } from "@/lib/sidebar-state";
import { clusterLabel } from "@/lib/solana/explorer";

/**
 * `/admin/**` shell. Mirrors the project-page app shell exactly so the visual
 * language is identical.
 *
 * Auth boundary (CVE-2025-29927 mitigation): proxy.ts only 404s admin routes
 * cosmetically. The layout re-validates the session AND the `admin.access`
 * permission inside the route. Each page additionally re-checks its own
 * narrower permission (e.g. `admin.users.role.grant` on /admin/users).
 *
 * Stub mode (no DB) → 404 to keep the surface area off the public web.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasCredentials.db()) {
    notFound();
  }

  const session = await requireAuthSession("/admin");

  const ok = await hasPermission("admin.access", { userId: session.user.id });
  if (!ok) {
    notFound();
  }
  const defaultSidebarCollapsed = await getDefaultSidebarCollapsed();

  return (
    <SidebarProvider defaultCollapsed={defaultSidebarCollapsed}>
      <div className="flex h-screen overflow-hidden bg-bg text-fg">
        <div className="contents lg:block lg:shrink-0 lg:p-3 lg:pr-0">
          <AppSidebar surface={{ kind: "admin" }} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <main
            id="main-content"
            tabIndex={-1}
            className="min-w-0 flex-1 overflow-y-auto px-4 pt-4 pb-3 outline-none"
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
              Admin · {clusterLabel()} · BAGS.fm
            </span>
            <div className="flex items-center gap-1">
              <SocialLink
                href="https://github.com/SYMBaiEX/gitshipt"
                label="GitHub repo"
              >
                <Github className="size-4" />
              </SocialLink>
              <SocialLink href="https://x.com/GitShipt" label="GitShipt on X">
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
      className="gb-control gb-control-icon gb-control-ghost inline-flex size-11 items-center justify-center rounded-md text-fg-muted hover:text-fg lg:size-7"
    >
      {children}
    </Link>
  );
}
