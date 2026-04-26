import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { AppShell } from "./_components/AppShell";
import { Card } from "@/components/ui/card";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/**
 * Streaming skeleton for /dashboard. Mirrors the page shape:
 *   - Header strip: title + lede
 *   - 4-up KPI tile row
 *   - 2-col grid: my projects list + recent activity feed
 */
export default function DashboardLoading() {
  return (
    <AppShell sidebar={<AppSidebar surface={{ kind: "public" }} />}>
      <div className="mx-auto flex w-full max-w-content flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <SkeletonText lines={1} className="max-w-md" />
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
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[40px_1fr_120px] items-center gap-3 border-b border-border py-3 last:border-b-0"
              >
                <Skeleton shape="circle" className="size-8 rounded-lg" />
                <Skeleton className="h-4" />
                <Skeleton className="h-4" />
              </div>
            ))}
          </Card>

          <Card depth="flat" padding="default">
            <Skeleton className="mb-4 h-5 w-40" />
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton shape="circle" className="size-6" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
