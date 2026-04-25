/**
 * Streaming skeleton for /r/[org]/[repo]. Renders the sidebar shape and a
 * stack of card placeholders so the layout doesn't reflow when data lands.
 *
 * Pure server component — no animation libs, just a subtle pulsing tone via
 * surface-elevated to hint at "loading" without distracting motion.
 */
export default function ProjectLoading() {
  return (
    <div className="flex min-h-screen bg-bg text-fg">
      <aside className="hidden h-screen w-sidebar shrink-0 border-r border-border bg-bg lg:block">
        <div className="px-5 py-5">
          <div className="h-8 w-32 rounded-md bg-surface-elevated" />
        </div>
        <div className="space-y-2 px-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-full rounded-md bg-surface-elevated/60"
            />
          ))}
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-content px-margin py-8">
          <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex min-w-0 flex-col gap-gutter">
              <div className="grid grid-cols-1 gap-gutter md:grid-cols-[minmax(0,1fr)_280px]">
                <Skeleton className="h-36" />
                <Skeleton className="h-36" />
              </div>
              <Skeleton className="h-[640px]" />
            </div>
            <aside className="flex min-w-0 flex-col gap-gutter">
              <Skeleton className="h-80" />
              <Skeleton className="h-64" />
              <Skeleton className="h-48" />
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-lg border border-border bg-surface ${className ?? ""}`}
    />
  );
}
