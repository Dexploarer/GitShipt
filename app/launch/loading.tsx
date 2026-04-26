/**
 * Streaming skeleton for /launch — header strip + form-card placeholders.
 */
export default function LaunchLoading() {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-6">
      <div className="flex flex-col gap-2">
        <div className="h-9 w-64 animate-pulse rounded-md bg-surface-elevated/40" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-surface-elevated/40" />
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-3">
          <div className="h-44 animate-pulse rounded-lg border border-border bg-surface-elevated/40" />
          <div className="h-64 animate-pulse rounded-lg border border-border bg-surface-elevated/40" />
        </div>
        <div className="h-80 animate-pulse rounded-lg border border-border bg-surface-elevated/40" />
      </div>
    </div>
  );
}
