export default function DocsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <div className="h-9 w-72 animate-pulse rounded-md bg-surface-elevated/40" />
      <div className="h-4 w-full max-w-xl animate-pulse rounded-md bg-surface-elevated/40" />
      <div className="h-4 w-full max-w-md animate-pulse rounded-md bg-surface-elevated/40" />
      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-border bg-surface-elevated/40"
          />
        ))}
      </div>
    </div>
  );
}
