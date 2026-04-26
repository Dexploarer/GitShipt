export default function LeaderboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-6">
      <div className="flex flex-col gap-2">
        <div className="h-9 w-72 animate-pulse rounded-md bg-surface-elevated/40" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-surface-elevated/40" />
      </div>
      <div className="rounded-lg border border-border bg-surface">
        <div className="grid grid-cols-[40px_1fr_120px_120px] gap-3 border-b border-border px-4 py-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-3 animate-pulse rounded-md bg-surface-elevated/40"
            />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[40px_1fr_120px_120px] gap-3 border-b border-border px-4 py-4 last:border-b-0"
          >
            <div className="size-8 animate-pulse rounded-lg bg-surface-elevated/40" />
            <div className="h-4 animate-pulse rounded-md bg-surface-elevated/40" />
            <div className="h-4 animate-pulse rounded-md bg-surface-elevated/40" />
            <div className="h-4 animate-pulse rounded-md bg-surface-elevated/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
