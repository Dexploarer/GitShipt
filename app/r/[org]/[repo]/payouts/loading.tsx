import { Card } from "@/components/ui/card";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/**
 * Streaming skeleton for /r/[org]/[repo]/payouts. Mirrors the page shape:
 *   - Breadcrumb + header
 *   - Payouts table: header + 8 rows (date, recipient, amount, status)
 */
export default function ProjectPayoutsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-8 w-64" />
        <SkeletonText lines={1} className="max-w-xl" />
      </div>
      <Card depth="flat" padding="none" className="overflow-hidden">
        <div className="grid grid-cols-[120px_1fr_120px_120px] gap-3 border-b border-border px-4 py-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-3" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[120px_1fr_120px_120px] items-center gap-3 border-b border-border px-4 py-4 last:border-b-0"
          >
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
          </div>
        ))}
      </Card>
    </div>
  );
}
