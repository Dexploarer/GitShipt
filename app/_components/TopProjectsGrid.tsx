import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatSol } from "@/lib/format";
import type { LandingProject } from "@/lib/queries/global";

/**
 * Curated grid of the top live projects, headlined on the landing. Each
 * card is a `<Link>` and uses `Card depth="raised"` so the section reads
 * as the page's primary anchor below the hero strip.
 *
 * Inline `TopProjectCard` keeps this section self-contained — when Agent A
 * lands a richer ProjectCard in `components/discovery/`, swap the import
 * and delete the local definition.
 */
export function TopProjectsGrid({ projects }: { projects: LandingProject[] }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-headline-md tracking-tight text-fg">
            Top projects
          </h2>
          <p className="text-body-md text-fg-secondary">
            The repos with the most fees flowing to contributors right now.
          </p>
        </div>
        <Link
          href="/explore"
          className="inline-flex items-center gap-1.5 text-label-md text-fg-secondary transition-colors hover:text-fg"
        >
          View all
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card depth="flat" padding="lg" className="text-center">
          <p className="text-body-md text-fg-secondary">
            No live projects yet — be the first to launch.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <TopProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Inline project card. Mirrors the project page's visual language without
 * pulling in any of the heavier project-page primitives.
 */
function TopProjectCard({ project }: { project: LandingProject }) {
  const avatar =
    project.imageUrl ?? `https://github.com/${project.ghOwner}.png`;
  return (
    <Link href={`/r/${project.slug}`} className="group block">
      <Card
        depth="raised"
        padding="default"
        className="flex h-full flex-col gap-4 transition-colors group-hover:border-border-strong"
      >
        <div className="flex items-start gap-3">
          <Image
            src={avatar}
            alt=""
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-xl bg-surface-elevated"
            unoptimized
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-headline-sm tracking-tight text-fg">
                {project.name}
              </h3>
              <Badge
                variant="success"
                size="sm"
                dot
                aria-label={`Status ${project.status}`}
              >
                {project.status}
              </Badge>
            </div>
            <p className="truncate text-body-sm text-fg-muted">
              {project.slug}
            </p>
          </div>
        </div>

        {project.description ? (
          <p className="line-clamp-2 text-body-sm text-fg-secondary">
            {project.description}
          </p>
        ) : null}

        <div className="mt-auto grid grid-cols-2 gap-3 border-t border-border pt-4">
          <Stat
            label="Lifetime fees"
            value={formatSol(project.lifetimeFeesLamports)}
          />
          <Stat
            label="Daily pool"
            value={formatSol(project.dailyFeeLamports)}
          />
          <div className="col-span-2 flex items-center gap-1.5 text-label-sm text-fg-muted">
            <Users className="size-3.5" aria-hidden />
            <span>
              {project.contributorsCount} contributor
              {project.contributorsCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label-sm text-fg-muted">{label}</span>
      <span className="text-mono-md text-fg">{value}</span>
    </div>
  );
}
