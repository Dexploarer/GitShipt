import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";
import { ProjectSidebar } from "@/components/sidebar/ProjectSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getProjectPageData } from "@/lib/queries/project-page";
import { getProjectSnapshots } from "@/lib/queries/discovery";
import { SnapshotRow } from "./_components/SnapshotRow";

type Params = Promise<{ org: string; repo: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { org, repo } = await params;
  const data = await getProjectPageData(org, repo);
  if (!data) return { title: `${org}/${repo} · Snapshots` };
  return {
    title: `${data.header.name} · Snapshots`,
    description: `Historical leaderboard snapshots and Merkle roots for ${data.header.slug}.`,
  };
}

const PAGE_SIZE = 50;

export default async function ProjectSnapshotsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ org, repo }, sp] = await Promise.all([params, searchParams]);
  const data = await getProjectPageData(org, repo);
  if (!data) notFound();

  const { header, pool } = data;
  const slug = `${header.ghOwner}/${header.ghRepo}`;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  // Page-N support: pull (page * PAGE_SIZE) and slice on the server side.
  // Snapshots are bounded (1/day under normal cron); a single big read is fine.
  const allSnapshots = await getProjectSnapshots(header.id, page * PAGE_SIZE);
  const startIdx = (page - 1) * PAGE_SIZE;
  const snapshots = allSnapshots.slice(startIdx, startIdx + PAGE_SIZE);
  const hasNextPage = allSnapshots.length === page * PAGE_SIZE;

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-bg text-fg">
        <div className="shrink-0 p-3 pr-0">
          <ProjectSidebar
            slug={slug}
            // 'snapshots' isn't a top-level sidebar key — leaderboard is the
            // closest semantic anchor (snapshots are leaderboard freezes).
            active="leaderboard"
            canAdmin={false}
            token={{ header, pool }}
            wallet={{}}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="min-w-0 flex-1 overflow-y-auto px-4 pt-4 pb-6">
            <div className="mx-auto flex w-full max-w-content flex-col gap-6">
              <nav>
                <Link
                  href={`/r/${slug}`}
                  className="inline-flex items-center gap-1.5 text-label-sm text-fg-secondary transition-colors hover:text-fg"
                >
                  <ArrowLeft className="size-3.5" />
                  Back to overview
                </Link>
              </nav>

              <header className="flex flex-col gap-2">
                <h1 className="text-headline-lg tracking-tight">
                  {header.name} · Snapshots
                </h1>
                <p className="max-w-2xl text-body-md text-fg-secondary">
                  Each snapshot freezes the leaderboard, computes a Merkle
                  root, and feeds the next on-chain payout. Re-running scoring
                  on the same inputs must reproduce the same root.
                </p>
              </header>

              {snapshots.length === 0 ? (
                <Empty />
              ) : (
                <ul className="flex flex-col gap-3">
                  {snapshots.map((row) => (
                    <li key={row.id}>
                      <SnapshotRow row={row} />
                    </li>
                  ))}
                </ul>
              )}

              {snapshots.length > 0 ? (
                <Pagination
                  slug={slug}
                  page={page}
                  hasNextPage={hasNextPage}
                />
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Empty() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-16 text-center">
      <History className="size-12 text-fg-muted" aria-hidden />
      <h2 className="text-headline-sm text-fg">No snapshots yet</h2>
      <p className="text-body-md text-fg-secondary">
        The first snapshot lands at 00:30 UTC after the project goes live.
      </p>
    </div>
  );
}

function Pagination({
  slug,
  page,
  hasNextPage,
}: {
  slug: string;
  page: number;
  hasNextPage: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border pt-4 text-label-sm text-fg-secondary">
      <span className="text-mono-sm text-fg-muted">Page {page}</span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={
              page - 1 === 1
                ? `/r/${slug}/snapshots`
                : `/r/${slug}/snapshots?page=${page - 1}`
            }
            className="inline-flex h-9 items-center rounded-md border border-border-strong bg-surface px-3 text-fg transition-colors hover:bg-surface-elevated"
          >
            Previous
          </Link>
        ) : null}
        {hasNextPage ? (
          <Link
            href={`/r/${slug}/snapshots?page=${page + 1}`}
            className="inline-flex h-9 items-center rounded-md border border-border-strong bg-surface px-3 text-fg transition-colors hover:bg-surface-elevated"
          >
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}
