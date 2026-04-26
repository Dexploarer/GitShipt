import { Card } from "@repo/ui";
import { Skeleton, SkeletonText } from "@repo/ui";

/**
 * Streaming skeleton for /r/[org]/[repo]/snapshots. Mirrors the page shape:
 *   - Breadcrumb + header
 *   - Stack of snapshot row cards (date + summary + view button)
 */
export default function ProjectSnapshotsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-8 w-72" />
        <SkeletonText lines={1} className="max-w-xl" />
      </div>
      <ul className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
            <Card depth="flat" padding="default">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-9 w-24 rounded-md" />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
