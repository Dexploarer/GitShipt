import { Card } from "@/components/ui/card";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/**
 * Streaming skeleton for /r/[org]/[repo]/repository. Mirrors the page shape:
 *   - Breadcrumb + header
 *   - 3-col grid of repo info cards (lang/stars/forks, contributors, commits)
 */
export default function ProjectRepositoryLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-8 w-56" />
        <SkeletonText lines={1} className="max-w-xl" />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} depth="flat" padding="default">
            <Skeleton className="mb-3 h-5 w-1/2" />
            <Skeleton className="mb-2 h-7 w-2/3" />
            <SkeletonText lines={2} />
          </Card>
        ))}
      </div>
    </div>
  );
}
