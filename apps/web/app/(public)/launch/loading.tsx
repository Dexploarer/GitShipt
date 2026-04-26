import { Card } from "@repo/ui";
import { Skeleton, SkeletonText } from "@repo/ui";

/**
 * Streaming skeleton for /launch. Mirrors the wizard page shape inside the
 * shared `<PublicAppShell>` chrome:
 *   - Header strip (h1 + subtitle)
 *   - Step indicator strip (4 dots + connector lines)
 *   - Two-col body: form panel + summary side-card
 */
export default function LaunchLoading() {
  return (
    <div className="flex flex-col gap-4 py-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <SkeletonText lines={1} className="max-w-xl" />
      </div>

      <div className="flex items-center gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-1 items-center gap-2">
            <Skeleton shape="circle" className="size-7" />
            <Skeleton className="h-3 flex-1" />
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-3">
          <Card depth="flat" padding="default">
            <Skeleton className="mb-3 h-5 w-1/3" />
            <SkeletonText lines={2} />
            <div className="mt-4 grid gap-3">
              <Skeleton className="h-10 rounded-md" />
              <Skeleton className="h-10 rounded-md" />
            </div>
          </Card>
          <Card depth="flat" padding="default">
            <Skeleton className="mb-3 h-5 w-1/3" />
            <div className="grid gap-3">
              <Skeleton className="h-10 rounded-md" />
              <Skeleton className="h-24 rounded-md" />
              <Skeleton className="h-10 rounded-md" />
            </div>
          </Card>
        </div>
        <Card depth="flat" padding="default">
          <Skeleton className="mb-3 h-5 w-1/2" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-4 h-10 w-full rounded-md" />
        </Card>
      </div>
    </div>
  );
}
