import { Card } from "@repo/ui";
import { Skeleton } from "@repo/ui";

/**
 * Streaming skeleton for /r/[org]/[repo]/snapshots. Mirrors the page shape:
 *   - Breadcrumb + header
 *   - Stack of snapshot row cards (date + summary + view button)
 */
export default function ProjectSnapshotsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-3 w-48" />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.75rem] rounded-lg" />
        ))}
      </section>

      <Card depth="raised" padding="none" className="overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_110px_110px_140px_170px_96px] items-center gap-3 border-b border-border bg-surface-elevated/40 px-5 py-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-3 rounded-sm" />
          ))}
        </div>
        <ul className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="grid grid-cols-[minmax(0,1fr)_110px_110px_140px_170px_96px] items-center gap-3 px-5 py-3"
            >
              <Skeleton className="h-8 rounded-sm" />
              <Skeleton className="h-6 rounded-full" />
              <Skeleton className="h-4 rounded-sm" />
              <Skeleton className="h-4 rounded-sm" />
              <Skeleton className="h-4 rounded-sm" />
              <Skeleton className="h-8 rounded-md" />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
