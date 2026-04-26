import { AppShell } from "../../_components/AppShell";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { Card } from "@/components/ui/card";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/**
 * Streaming skeleton for /dashboard/projects/[id]. Mirrors the project
 * console page shape:
 *   - Header row: title + action button
 *   - 4-up KPI tile row
 *   - 2-col detail cards (token / payouts)
 */
export default function DashboardProjectLoading() {
  return (
    <AppShell
      sidebar={
        <AppSidebar
          surface={{
            kind: "owner-project",
            projectId: "",
            projectName: "—",
            slug: "—/—",
          }}
        />
      }
    >
      <div className="mx-auto flex w-full max-w-content flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-64" />
            <SkeletonText lines={1} className="w-48" />
          </div>
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} depth="flat" padding="default">
              <Skeleton className="mb-2 h-3 w-1/2" />
              <Skeleton className="h-7 w-2/3" />
            </Card>
          ))}
        </section>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card depth="flat" padding="default">
            <Skeleton className="mb-4 h-5 w-40" />
            <SkeletonText lines={4} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          </Card>
          <Card depth="flat" padding="default">
            <Skeleton className="mb-4 h-5 w-40" />
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_100px_80px] items-center gap-3"
                >
                  <Skeleton className="h-4" />
                  <Skeleton className="h-4" />
                  <Skeleton className="h-4" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
