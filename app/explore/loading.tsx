import { PublicAppShell } from "@/components/public/PublicAppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/**
 * Streaming skeleton for /explore. Mirrors the page shape:
 *   - Header strip: title + lede
 *   - Search/filter bar
 *   - 3-col grid of project cards (avatar + meta + body + 3 stat pills)
 */
export default function ExploreLoading() {
  return (
    <PublicAppShell active="explore">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-72" />
        <SkeletonText lines={2} lastLineWidth="w-1/2" className="max-w-2xl" />
      </div>

      <div className="mt-8">
        <Skeleton className="h-[52px] w-full rounded-md" />
      </div>

      <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
            <Card depth="flat" padding="default">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton shape="circle" className="size-10" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <SkeletonText lines={2} />
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Skeleton className="h-7" />
                  <Skeleton className="h-7" />
                  <Skeleton className="h-7" />
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </PublicAppShell>
  );
}
