import { Card } from "@repo/ui";
import { Skeleton, SkeletonText } from "@repo/ui";

/**
 * Streaming skeleton for /r/[org]/[repo]/docs. Mirrors the page shape:
 *   - Breadcrumb + header
 *   - Stack of doc-section cards (heading + paragraph)
 */
export default function ProjectDocsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-8 w-72" />
        <SkeletonText lines={1} className="max-w-xl" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} depth="flat" padding="default">
            <Skeleton className="mb-3 h-5 w-1/2" />
            <SkeletonText lines={3} />
          </Card>
        ))}
      </div>
    </div>
  );
}
