import Link from "next/link";
import type { Metadata } from "next";
import { PublicAppShell } from "@/components/public/PublicAppShell";
import { cn } from "@/lib/utils";
import { getGlobalLeaderboard } from "@/lib/queries/global";
import { GlobalLeaderboardTable } from "./_components/GlobalLeaderboardTable";

export const metadata: Metadata = {
  title: "Global leaderboard · GitBags",
  description:
    "Top contributors and projects across every GitBags repo, ranked by lifetime SOL earned.",
};

type Mode = "contributor" | "project";

function parseMode(value: string | string[] | undefined): Mode {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "project" ? "project" : "contributor";
}

/**
 * Public global leaderboard. Two views (contributor / project) selected via
 * the `?mode=` search param. Toggle is a server-rendered pair of `<Link>`s
 * — no client JS needed for navigation, and the active state survives
 * sharing/bookmarking the URL.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const mode = parseMode(params.mode);
  const data = await getGlobalLeaderboard();

  return (
    <PublicAppShell active="leaderboard">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-headline-lg tracking-tight text-fg">
            Global leaderboard
          </h1>
          <p className="max-w-2xl text-body-lg text-fg-secondary">
            Top contributors across every GitBags repo, ranked by lifetime
            SOL earned. Toggle to project view to see which repos are
            distributing the most fees.
          </p>
        </header>

        <ModeToggle mode={mode} />

        {mode === "contributor" ? (
          <GlobalLeaderboardTable
            mode="contributor"
            rows={data.byContributor}
          />
        ) : (
          <GlobalLeaderboardTable mode="project" rows={data.byProject} />
        )}
      </div>
    </PublicAppShell>
  );
}

/**
 * Server-rendered toggle. Each option is a `<Link>` whose href flips the
 * `mode` search param. Active option uses `surface-elevated` + `inset-light`
 * shadow to match the sidebar item active treatment.
 */
function ModeToggle({ mode }: { mode: Mode }) {
  const options: Array<{ value: Mode; label: string; href: string }> = [
    { value: "contributor", label: "By contributor", href: "/leaderboard" },
    {
      value: "project",
      label: "By project",
      href: "/leaderboard?mode=project",
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Leaderboard view"
      className="inline-flex w-fit items-center gap-1 rounded-lg border border-border bg-surface p-1"
    >
      {options.map(({ value, label, href }) => {
        const on = mode === value;
        return (
          <Link
            key={value}
            href={href}
            role="tab"
            aria-selected={on}
            className={cn(
              "rounded-md px-3 py-1.5 text-label-md transition-colors",
              on
                ? "bg-surface-elevated text-fg shadow-inset-light"
                : "text-fg-secondary hover:bg-surface-elevated/60 hover:text-fg",
            )}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
