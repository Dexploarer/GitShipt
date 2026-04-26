/**
 * Streaming skeleton for /admin — Money Console shape: 5-up stat tiles +
 * 2x2 bento card grid below.
 */
export default function AdminLoading() {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-6">
      <div className="flex flex-col gap-2">
        <div className="h-9 w-64 animate-pulse rounded-md bg-surface-elevated/40" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-surface-elevated/40" />
      </div>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-lg border border-border bg-surface-elevated/40"
          />
        ))}
      </section>
      <section className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-lg border border-border bg-surface-elevated/40"
          />
        ))}
      </section>
    </div>
  );
}
