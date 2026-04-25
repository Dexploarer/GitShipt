import { PublicAppShell } from "@/components/public/PublicAppShell";

export default function ContributorLoading() {
  return (
    <PublicAppShell>
      <header className="flex flex-col gap-6">
        <div className="flex items-center gap-5">
          <div className="size-24 shrink-0 animate-pulse rounded-2xl bg-surface-elevated" />
          <div className="flex-1 space-y-2">
            <div className="h-10 w-1/3 animate-pulse rounded-md bg-surface-elevated" />
            <div className="h-5 w-1/4 animate-pulse rounded-md bg-surface-elevated" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-[68px] animate-pulse rounded-lg border border-border/60 bg-surface/40"
            />
          ))}
        </div>
      </header>

      <section className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-96 animate-pulse rounded-lg border border-border bg-surface shadow-card-elevated" />
        <div className="h-96 animate-pulse rounded-lg border border-border bg-surface shadow-card-elevated" />
      </section>
    </PublicAppShell>
  );
}
