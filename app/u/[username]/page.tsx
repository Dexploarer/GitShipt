import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  Calendar,
  ExternalLink,
  Github,
  Globe,
  GitFork,
  MapPin,
  Twitter,
  Users,
} from "lucide-react";
import { PublicAppShell } from "@/components/public/PublicAppShell";
import { Badge } from "@/components/ui/badge";
import { getContributorProfile } from "@/lib/queries/discovery";
import { getGitHubUser, type GitHubUserProfile } from "@/lib/github/users";
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
  const [profile, gh] = await Promise.all([
    getContributorProfile(username),
    getGitHubUser(username),
  ]);
  if (!profile && !gh) {
    return { title: `@${username}` };
  }
  const name = gh?.name ?? profile?.ghUsername ?? username;
  return {
    title: `${name} (@${username})`,
    description: gh?.bio
      ? gh.bio
      : `Earnings, projects, and contributions for @${username} on GitBags.`,
  };
}

export default async function ContributorProfilePage({
  params,
}: {
  params: Params;
}) {
  const { username } = await params;
  const [profile, gh] = await Promise.all([
    getContributorProfile(username),
    getGitHubUser(username),
  ]);

  // 404 only when neither GitHub knows them nor we have any contributor row.
  // Real GitHub users without a contribution still get a profile page that
  // shows their bio and links them to /explore — useful for sharing.
  if (!profile && !gh) notFound();

  const displayName = gh?.name ?? profile?.ghUsername ?? username;
  const avatar = gh?.avatarUrl ?? profile?.avatarUrl ?? `https://github.com/${username}.png`;

  return (
    <PublicAppShell>
      <div className="flex flex-col gap-8 lg:gap-10">
        <header className="flex flex-col gap-6">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatar}
              alt=""
              className="size-28 shrink-0 rounded-2xl border border-border/60 object-cover shadow-card-elevated"
              width={112}
              height={112}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[40px] font-semibold leading-[1.04] tracking-[-0.025em] text-fg sm:text-[48px]">
                  {displayName}
                </h1>
                {gh ? (
                  <Badge variant="default" size="sm">
                    GitHub verified
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-body-md text-fg-secondary">
                <span className="text-mono-md text-fg-secondary">
                  @{username}
                </span>
                <Link
                  href={`https://github.com/${username}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-label-md text-fg-secondary transition-colors hover:text-fg"
                >
                  <Github className="size-4" />
                  View on GitHub
                  <ExternalLink className="size-3" />
                </Link>
              </div>
              {gh?.bio ? (
                <p className="max-w-2xl text-body-md text-fg-secondary">
                  {gh.bio}
                </p>
              ) : null}
              {gh ? <GitHubMetaRow gh={gh} /> : null}
            </div>
          </div>

          {/* KPI strip — bordered cells, not cards. Matches the QuickStat pattern. */}
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <KpiCell label="Lifetime SOL earned">
              <span className="text-mono-md text-fg">
                {formatSol(profile?.totalLifetimeLamports ?? 0n, 4)}
              </span>
            </KpiCell>
            <KpiCell label="Projects on GitBags">
              <span className="text-mono-md text-fg">
                {(profile?.projectsCount ?? 0).toLocaleString("en-US")}
              </span>
            </KpiCell>
            <KpiCell label="Total PRs">
              <span className="text-mono-md text-fg">
                {formatScore(profile?.totalPRs ?? 0)}
              </span>
            </KpiCell>
            <KpiCell label="Total commits">
              <span className="text-mono-md text-fg">
                {formatScore(profile?.totalCommits ?? 0)}
              </span>
            </KpiCell>
          </dl>

          {gh ? <GitHubStatRow gh={gh} /> : null}
        </header>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ProjectsContributedTo rows={profile?.byProject ?? []} />
          <EarningsHistory rows={profile?.recentPayouts ?? []} />
        </section>
      </div>
    </PublicAppShell>
  );
}

function GitHubMetaRow({ gh }: { gh: GitHubUserProfile }) {
  const items: Array<{ icon: React.ReactNode; label: React.ReactNode }> = [];

  if (gh.company)
    items.push({
      icon: <Building2 className="size-3.5" aria-hidden />,
      label: gh.company,
    });
  if (gh.location)
    items.push({
      icon: <MapPin className="size-3.5" aria-hidden />,
      label: gh.location,
    });
  if (gh.blog) {
    const href = gh.blog.startsWith("http") ? gh.blog : `https://${gh.blog}`;
    items.push({
      icon: <Globe className="size-3.5" aria-hidden />,
      label: (
        <Link
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="transition-colors hover:text-fg"
        >
          {gh.blog.replace(/^https?:\/\//, "")}
        </Link>
      ),
    });
  }
  if (gh.twitterUsername)
    items.push({
      icon: <Twitter className="size-3.5" aria-hidden />,
      label: (
        <Link
          href={`https://x.com/${gh.twitterUsername}`}
          target="_blank"
          rel="noreferrer noopener"
          className="transition-colors hover:text-fg"
        >
          @{gh.twitterUsername}
        </Link>
      ),
    });

  const joined = new Date(gh.createdAt);
  items.push({
    icon: <Calendar className="size-3.5" aria-hidden />,
    label: `Joined ${joined.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    })}`,
  });

  if (items.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-fg-muted">
      {items.map((it, i) => (
        <li key={i} className="inline-flex items-center gap-1.5">
          {it.icon}
          <span className="text-fg-secondary">{it.label}</span>
        </li>
      ))}
    </ul>
  );
}

function GitHubStatRow({ gh }: { gh: GitHubUserProfile }) {
  return (
    <dl className="grid grid-cols-3 gap-2">
      <KpiCell
        label="Public repos"
        icon={<GitFork className="size-3" aria-hidden />}
      >
        <span className="text-mono-md text-fg">
          {gh.publicRepos.toLocaleString("en-US")}
        </span>
      </KpiCell>
      <KpiCell
        label="Followers"
        icon={<Users className="size-3" aria-hidden />}
      >
        <span className="text-mono-md text-fg">
          {gh.followers.toLocaleString("en-US")}
        </span>
      </KpiCell>
      <KpiCell label="Following">
        <span className="text-mono-md text-fg">
          {gh.following.toLocaleString("en-US")}
        </span>
      </KpiCell>
    </dl>
  );
}

function KpiCell({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface/40 px-4 py-3">
      <dt className="inline-flex items-center gap-1 text-label-sm text-fg-muted">
        {icon}
        {label}
      </dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}
