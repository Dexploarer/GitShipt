/**
 * Streaming skeleton for /dashboard. Mirrors the page shape: 4-up KPI tile
 * row + a list-row skeleton for the recent activity / projects feed.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-6">
      <div className="flex flex-col gap-2">
        <div className="h-9 w-56 animate-pulse rounded-md bg-surface-elevated/40" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-surface-elevated/40" />
      </div>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-lg border border-border bg-surface-elevated/40"
          />
        ))}
      </section>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <div className="h-5 w-40 animate-pulse rounded-md bg-surface-elevated/40" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[40px_1fr_120px] gap-3 border-b border-border py-3 last:border-b-0"
          >
            <div className="size-8 animate-pulse rounded-lg bg-surface-elevated/40" />
            <div className="h-4 animate-pulse rounded-md bg-surface-elevated/40" />
            <div className="h-4 animate-pulse rounded-md bg-surface-elevated/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
