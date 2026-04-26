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
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-8 w-40" />
        <SkeletonText lines={1} className="max-w-xl" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card depth="flat" padding="default">
          <Skeleton className="mb-3 h-5 w-1/3" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        </Card>
        <Card depth="flat" padding="default">
          <Skeleton className="mb-3 h-5 w-1/3" />
          <Skeleton className="mb-2 h-8 w-2/3" />
          <Skeleton className="h-32 w-full rounded-md" />
        </Card>
      </div>
      <Card depth="flat" padding="default">
        <Skeleton className="mb-3 h-5 w-1/4" />
        <SkeletonText lines={4} />
      </Card>
    </div>
  );
}
