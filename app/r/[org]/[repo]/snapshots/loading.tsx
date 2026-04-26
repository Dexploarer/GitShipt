export default function ProjectSnapshotsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="h-4 w-48 animate-pulse rounded-md bg-surface-elevated/40" />
        <div className="h-9 w-72 animate-pulse rounded-md bg-surface-elevated/40" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-surface-elevated/40" />
      </div>
      <ul className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li
            key={i}
            className="h-20 animate-pulse rounded-lg border border-border bg-surface-elevated/40"
          />
        ))}
      </ul>
    </div>
  );
}
