"use client";

import * as React from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { MobileSidebarTrigger } from "@/components/sidebar/MobileSidebarTrigger";
import type { SidebarUserCardProps } from "@/components/sidebar/SidebarUserCard";
import type { AppSidebarSurface } from "@/components/sidebar/AppSidebar";
import type { ProjectSidebarActive } from "./ProjectShell";

const ACTIVE_BY_SEGMENT: Record<string, ProjectSidebarActive> = {
  docs: "docs",
  payouts: "payouts",
  repository: "repository",
  snapshots: "snapshots",
  token: "token",
};

function useProjectActive(
  override?: ProjectSidebarActive,
): ProjectSidebarActive {
  const segment = useSelectedLayoutSegment();
  if (override) return override;
  if (segment && segment in ACTIVE_BY_SEGMENT) {
    return ACTIVE_BY_SEGMENT[segment]!;
  }
  return "leaderboard";
}

export function ProjectShellSidebar({
  user,
  surface,
  active,
}: {
  user?: SidebarUserCardProps | null;
  surface: AppSidebarSurface;
  active?: ProjectSidebarActive;
}) {
  const activeKey = useProjectActive(active);
  return <AppSidebar user={user} surface={surface} activeKey={activeKey} />;
}

export function ProjectShellMain({
  active,
  fitViewport,
  children,
}: {
  active?: ProjectSidebarActive;
  fitViewport?: boolean;
  children: React.ReactNode;
}) {
  const activeKey = useProjectActive(active);
  const shouldFitViewport = fitViewport ?? activeKey === "leaderboard";

  return (
    <main
      className={
        shouldFitViewport
          ? "min-w-0 flex-1 overflow-y-auto px-4 pt-4 pb-3 lg:overflow-hidden"
          : "min-w-0 flex-1 overflow-y-auto px-4 pt-4 pb-3"
      }
    >
      <div className="mb-3 lg:hidden">
        <MobileSidebarTrigger />
      </div>
      {children}
    </main>
  );
}
