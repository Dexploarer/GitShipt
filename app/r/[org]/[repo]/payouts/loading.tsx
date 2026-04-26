export default function ProjectPayoutsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="h-4 w-48 animate-pulse rounded-md bg-surface-elevated/40" />
        <div className="h-9 w-64 animate-pulse rounded-md bg-surface-elevated/40" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-surface-elevated/40" />
      </div>
      <div className="rounded-lg border border-border bg-surface">
        <div className="grid grid-cols-[120px_1fr_120px_120px] gap-3 border-b border-border px-4 py-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-3 animate-pulse rounded-md bg-surface-elevated/40"
            />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[120px_1fr_120px_120px] gap-3 border-b border-border px-4 py-4 last:border-b-0"
          >
            {Array.from({ length: 4 }).map((_, j) => (
              <div
                key={j}
                className="h-4 animate-pulse rounded-md bg-surface-elevated/40"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
