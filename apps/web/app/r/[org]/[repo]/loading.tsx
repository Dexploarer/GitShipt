import { Card } from "@repo/ui";
import { Skeleton, SkeletonText } from "@repo/ui";

/**
 * Streaming skeleton for /r/[org]/[repo] (project leaderboard / overview).
 *
 * The segment layout owns ProjectShell, so this renders only the inner
 * leaderboard content skeleton and never duplicates auth/sidebar chrome.
 */
export default function ProjectLoading() {
  return (
    <div className="mx-auto w-full max-w-content">
      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-gutter">
          <div className="grid grid-cols-1 gap-gutter md:grid-cols-[minmax(0,1fr)_280px]">
            <Card depth="flat" padding="default" className="h-36">
              <div className="flex items-center gap-3">
                <Skeleton shape="circle" className="size-12 rounded-lg" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <SkeletonText lines={2} className="mt-3" />
            </Card>
            <Card depth="flat" padding="default" className="h-36">
              <Skeleton className="mb-2 h-3 w-1/2" />
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="mt-3 h-12 w-full rounded-md" />
            </Card>
          </div>

          <Card depth="flat" padding="none" className="overflow-hidden">
            <div className="grid grid-cols-[40px_1fr_120px_100px] gap-3 border-b border-border px-4 py-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-3" />
              ))}
            </div>
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[40px_1fr_120px_100px] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <Skeleton shape="circle" className="size-8 rounded-lg" />
                <div className="flex items-center gap-3">
                  <Skeleton shape="circle" className="size-7" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-4" />
                <Skeleton className="h-4" />
              </div>
            ))}
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-gutter">
          <Card depth="flat" padding="default">
            <Skeleton className="mb-3 h-4 w-1/3" />
            <Skeleton className="mb-2 h-8 w-2/3" />
            <Skeleton className="mb-4 h-3 w-1/2" />
            <Skeleton className="h-24 w-full rounded-md" />
          </Card>
          <Card depth="flat" padding="default">
            <Skeleton className="mb-3 h-4 w-1/3" />
            <Skeleton className="mb-2 h-7 w-1/2" />
            <SkeletonText lines={2} />
          </Card>
          <Card depth="flat" padding="default">
            <Skeleton className="mb-3 h-4 w-1/3" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 py-2"
              >
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            ))}
          </Card>
        </aside>
      </div>
    </div>
  );
}
