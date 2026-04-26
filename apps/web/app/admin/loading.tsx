import { Card } from "@repo/ui";
import { Skeleton, SkeletonText } from "@repo/ui";

/**
 * Streaming skeleton for /admin (Money Console). The parent admin layout
 * already supplies the AdminContextSidebar + footer chrome, so this
 * mirrors only the inner shape:
 *   - Header strip: title + lede
 *   - 5-up stat tile row
 *   - 2x2 bento card grid (charts / tables)
 */
export default function AdminLoading() {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <SkeletonText lines={1} className="max-w-xl" />
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} depth="flat" padding="default">
            <Skeleton className="mb-2 h-3 w-1/2" />
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="mt-2 h-2 w-1/3" />
          </Card>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} depth="flat" padding="default">
            <div className="mb-3 flex items-center justify-between">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-40 w-full rounded-md" />
            <div className="mt-3 flex items-center justify-between">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-3 w-1/5" />
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
