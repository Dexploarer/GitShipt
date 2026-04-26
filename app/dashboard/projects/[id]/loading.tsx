export default function DashboardProjectLoading() {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-64 animate-pulse rounded-md bg-surface-elevated/40" />
          <div className="h-4 w-48 animate-pulse rounded-md bg-surface-elevated/40" />
        </div>
        <div className="h-10 w-36 animate-pulse rounded-md bg-surface-elevated/40" />
      </div>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-lg border border-border bg-surface-elevated/40"
          />
        ))}
      </section>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg border border-border bg-surface-elevated/40" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-surface-elevated/40" />
      </div>
    </div>
  );
}
