export default function ProjectTokenLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="h-4 w-48 animate-pulse rounded-md bg-surface-elevated/40" />
        <div className="h-9 w-40 animate-pulse rounded-md bg-surface-elevated/40" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-surface-elevated/40" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg border border-border bg-surface-elevated/40" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-surface-elevated/40" />
      </div>
      <div className="h-48 animate-pulse rounded-lg border border-border bg-surface-elevated/40" />
    </div>
  );
}
