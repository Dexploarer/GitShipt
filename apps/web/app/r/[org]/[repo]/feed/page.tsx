import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper, Rss } from "lucide-react";
import { Button } from "@repo/ui";
import { Card } from "@repo/ui";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { getProjectPageData } from "@/lib/queries/project-page";
import { getProjectFeed } from "@/lib/queries/project-feed";
import type { PeriodDigestSubjects } from "@/db/schema";
import { PeriodDigestCard } from "./_components/PeriodDigestCard";

type Params = Promise<{ org: string; repo: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { org, repo } = await params;
  const data = await getProjectPageData(org, repo);
  if (!data) return { title: `${org}/${repo} · Feed` };
  return {
    title: `${data.header.name} · Feed`,
    description: `Daily digests + milestones for ${data.header.slug}. Synthesized from the leaderboard and git history.`,
    alternates: {
      types: {
        "application/atom+xml": `/r/${data.header.slug}/feed.atom`,
      },
    },
  };
}

export default function ProjectFeedPage({
  params,
}: {
  params: Params;
}) {
  return (
    <Suspense fallback={null}>
      <ProjectFeedPageContent params={params} />
    </Suspense>
  );
}

async function ProjectFeedPageContent({
  params,
}: {
  params: Params;
}) {
  const { org, repo } = await params;
  const data = await getProjectPageData(org, repo);
  if (!data) notFound();

  const { header } = data;
  const slug = `${header.ghOwner}/${header.ghRepo}`;
  const entries = await getProjectFeed(header.id, 50);
  const now = Date.now();

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "Projects", href: "/explore" },
          { label: header.name, href: `/r/${slug}` },
          { label: "Feed" },
        ]}
      />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-md text-fg">Project feed</h1>
          <p className="text-body-sm text-fg-secondary">
            Period digests + milestones for {header.name}. Synthesized from the
            leaderboard and indexed git history.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link
            href={`/r/${slug}/feed.atom`}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Atom feed"
          >
            <Rss className="size-4" /> Atom
          </Link>
        </Button>
      </header>

      {entries.length === 0 ? (
        <Empty />
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((row) => {
            const pinned =
              row.pinnedUntil != null && row.pinnedUntil.getTime() > now;
            if (row.kind === "period_digest") {
              // The schema's `subjects` is the union FeedEntrySubjects;
              // narrowing on `kind` lets us safely treat the payload as the
              // PeriodDigestSubjects shape. Both the writer and the schema
              // guarantee the discriminator agrees with the payload shape;
              // any future drift surfaces at insert time, not at render.
              const subjects = row.subjects as PeriodDigestSubjects;
              return (
                <li key={row.id}>
                  <PeriodDigestCard
                    subjects={subjects}
                    createdAt={row.createdAt}
                    pinned={pinned}
                  />
                </li>
              );
            }
            // Milestone kinds defined in schema but not yet emitted by writers
            // in v1. Falls back to the markdown body so the page never crashes
            // on a future kind that lands a row before its card component.
            return (
              <li key={row.id}>
                <FallbackMarkdownCard bodyMd={row.bodyMd} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Empty() {
  return (
    <Card
      depth="raised"
      padding="lg"
      className="flex flex-col items-center gap-3 text-center"
    >
      <Newspaper className="size-10 text-fg-muted" aria-hidden />
      <h2 className="text-headline-sm text-fg">No feed entries yet</h2>
      <p className="max-w-md text-body-md text-fg-secondary">
        The first card lands at the next snapshot. Period digests publish daily
        at 00:00 UTC; milestone cards publish when a new contributor lands their
        first ranked PR or a score threshold is crossed.
      </p>
    </Card>
  );
}

function FallbackMarkdownCard({ bodyMd }: { bodyMd: string }) {
  return (
    <Card depth="flat" padding="default">
      <pre className="whitespace-pre-wrap break-words text-body-sm text-fg-secondary">
        {bodyMd}
      </pre>
    </Card>
  );
}
