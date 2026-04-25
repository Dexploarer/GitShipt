import { PublicAppShell } from "@/components/public/PublicAppShell";

export default function ExploreLoading() {
  return (
    <PublicAppShell active="explore">
      <div className="flex flex-col gap-3">
        <h1 className="text-headline-lg tracking-tight">Explore projects</h1>
        <p className="max-w-2xl text-body-lg text-fg-secondary">
          Open-source repos rewarding their contributors with daily on-chain
          payouts.
        </p>
      </div>

      <div className="mt-8 h-[52px] rounded-md border border-border bg-surface" />

      <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <li
            key={i}
            className="h-56 rounded-lg border border-border bg-surface shadow-card-elevated"
          >
            <div className="h-full w-full animate-pulse rounded-lg bg-gradient-to-br from-surface to-surface-elevated" />
          </li>
        ))}
      </ul>
    </PublicAppShell>
  );
}
