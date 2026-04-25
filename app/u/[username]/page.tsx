import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Github } from "lucide-react";
import { PublicShell } from "@/components/public/PublicShell";
import { getContributorProfile } from "@/lib/queries/discovery";
import { formatScore, formatSol } from "@/lib/format";
import { ProjectsContributedTo } from "./_components/ProjectsContributedTo";
import { EarningsHistory } from "./_components/EarningsHistory";

type Params = Promise<{ username: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getContributorProfile(username);
  if (!profile) {
    return { title: `@${username} · GitBags` };
  }
  return {
    title: `@${profile.ghUsername} · GitBags`,
    description: `Earnings, projects, and contributions for @${profile.ghUsername} on GitBags.`,
  };
}

export default async function ContributorProfilePage({
  params,
}: {
  params: Params;
}) {
  const { username } = await params;
  const profile = await getContributorProfile(username);
  if (!profile) notFound();

  return (
    <PublicShell>
      <header className="flex flex-col gap-6">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={profile.avatarUrl}
            alt=""
            className="size-24 shrink-0 rounded-2xl border border-border object-cover"
            width={96}
            height={96}
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-display tracking-tight">
              {profile.ghUsername}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-body-lg text-fg-secondary">
              <span className="text-mono-md">@{profile.ghUsername}</span>
              <Link
                href={`https://github.com/${profile.ghUsername}`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-label-md text-fg-secondary transition-colors hover:text-fg"
              >
                <Github className="size-4" />
                View on GitHub
                <ExternalLink className="size-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* KPI strip — bordered cells, not cards. Matches the QuickStat pattern. */}
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <KpiCell label="Lifetime SOL earned">
            <span className="text-mono-md text-fg">
              {formatSol(profile.totalLifetimeLamports, 4)}
            </span>
          </KpiCell>
          <KpiCell label="Projects contributed">
            <span className="text-mono-md text-fg">
              {profile.projectsCount.toLocaleString("en-US")}
            </span>
          </KpiCell>
          <KpiCell label="Total PRs">
            <span className="text-mono-md text-fg">
              {formatScore(profile.totalPRs)}
            </span>
          </KpiCell>
          <KpiCell label="Total commits">
            <span className="text-mono-md text-fg">
              {formatScore(profile.totalCommits)}
            </span>
          </KpiCell>
        </dl>
      </header>

      <section className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProjectsContributedTo rows={profile.byProject} />
        <EarningsHistory rows={profile.recentPayouts} />
      </section>
    </PublicShell>
  );
}

function KpiCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface/40 px-4 py-3">
      <dt className="text-label-sm text-fg-muted">{label}</dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}
