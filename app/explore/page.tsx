import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";
import { PublicAppShell } from "@/components/public/PublicAppShell";
import {
  getAllPublicProjects,
  type ExploreFilters,
} from "@/lib/queries/discovery";
import { ExploreFilters as FiltersBar } from "./_components/ExploreFilters";
import { ProjectCard } from "./_components/ProjectCard";

export const metadata: Metadata = {
  title: "Explore projects · GitBags",
  description:
    "Open-source repos rewarding their contributors with daily on-chain payouts.",
};

type SearchParams = Promise<{
  status?: string;
  sort?: string;
  q?: string;
}>;

function parseFilters(raw: Awaited<SearchParams>): ExploreFilters {
  const status =
    raw.status === "live" || raw.status === "paused" || raw.status === "all"
      ? raw.status
      : "all";
  const sort =
    raw.sort === "lifetime" ||
    raw.sort === "contributors" ||
    raw.sort === "newest" ||
    raw.sort === "trending"
      ? raw.sort
      : "trending";
  return {
    status,
    sort,
    search: raw.q ?? undefined,
  };
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const projects = await getAllPublicProjects(filters);

  return (
    <PublicAppShell active="explore">
      <div className="flex flex-col gap-3">
        <h1 className="text-headline-lg tracking-tight">Explore projects</h1>
        <p className="max-w-2xl text-body-lg text-fg-secondary">
          Open-source repos rewarding their contributors with daily on-chain
          payouts.
        </p>
      </div>

      <div className="mt-8">
        <FiltersBar />
      </div>

      <div className="mt-8">
        {projects.length === 0 ? (
          <EmptyState hasFilters={Boolean(params.q || params.status || params.sort)} />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <li key={p.id}>
                <ProjectCard project={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </PublicAppShell>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-16 text-center">
      <Compass className="size-12 text-fg-muted" aria-hidden />
      <h2 className="text-headline-sm text-fg">No projects match</h2>
      <p className="text-body-md text-fg-secondary">
        {hasFilters
          ? "Try a different filter or clear your search to see every live project."
          : "No projects are live yet — be the first to launch one."}
      </p>
      {hasFilters ? (
        <Link
          href="/explore"
          className="mt-2 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-label-md text-fg transition-colors hover:bg-primary-hover"
        >
          Clear filters
        </Link>
      ) : (
        <Link
          href="/launch"
          className="mt-2 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-label-md text-fg transition-colors hover:bg-primary-hover"
        >
          Launch a project
        </Link>
      )}
    </div>
  );
}
