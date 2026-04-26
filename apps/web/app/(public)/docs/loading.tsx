import { Card } from "@repo/ui";
import { Skeleton, SkeletonText } from "@repo/ui";

/**
 * Streaming skeleton for /docs. Mirrors the page shape: hero title + lede
 * followed by a stack of doc-section cards (each = heading + paragraph).
 */
export default function DocsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Skeleton className="h-8 w-72" />
      <SkeletonText lines={2} lastLineWidth="w-2/3" />

      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} depth="flat" padding="default">
            <Skeleton className="mb-3 h-5 w-1/2" />
            <SkeletonText lines={3} />
          </Card>
        ))}
      </div>
    </div>
  );
}
