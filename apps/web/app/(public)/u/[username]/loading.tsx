import { Card } from "@repo/ui";
import { Skeleton } from "@repo/ui";

/**
 * Streaming skeleton for /u/[username]. Mirrors the contributor page shape:
 *   - Header: avatar + name/handle
 *   - 4-up stat tile row
 *   - 2-col grid (projects list + payouts list)
 */
export default function ContributorLoading() {
  return (
    <>
      <header className="flex flex-col gap-6">
        <div className="flex items-center gap-5">
          <Skeleton shape="circle" className="size-24 rounded-2xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-9 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} depth="flat" padding="sm">
              <Skeleton className="mb-2 h-3 w-1/2" />
              <Skeleton className="h-6 w-2/3" />
            </Card>
          ))}
        </div>
      </header>

      <section className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card depth="flat" padding="default">
          <Skeleton className="mb-4 h-5 w-1/3" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton shape="circle" className="size-8" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </Card>
        <Card depth="flat" padding="default">
          <Skeleton className="mb-4 h-5 w-1/3" />
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
      </section>
    </>
  );
}
