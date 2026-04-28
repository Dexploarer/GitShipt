import { Card } from "@repo/ui";
import { Skeleton, SkeletonText } from "@repo/ui";

/**
 * Streaming skeleton for /r/[org]/[repo]/token. Mirrors the page shape:
 *   - Breadcrumb + header
 *   - 2-col mint card / pool card row
 *   - Wide chart / metadata card below
 */
export default function ProjectTokenLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-3 w-48" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-4">
          <Card depth="flat" padding="default">
            <Skeleton className="mb-4 h-5 w-40" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[3.75rem] rounded-lg" />
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Skeleton className="h-[5.5rem] rounded-lg" />
              <Skeleton className="h-[5.5rem] rounded-lg" />
            </div>
          </Card>
          <Card depth="flat" padding="default">
            <Skeleton className="mb-4 h-5 w-36" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[4.75rem] rounded-lg" />
              ))}
            </div>
            <Skeleton className="mt-4 h-[5.5rem] rounded-lg" />
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[3.75rem] rounded-md" />
              ))}
            </div>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card depth="flat" padding="default">
            <Skeleton className="mb-3 h-5 w-24" />
            <SkeletonText lines={4} />
            <Skeleton className="mt-4 h-11 w-full rounded-md" />
          </Card>
          <Skeleton className="h-[15rem] rounded-lg" />
        </div>
      </div>
    </div>
  );
}
