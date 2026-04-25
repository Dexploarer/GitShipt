import Link from "next/link";
import { Github } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatSol } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PublicProjectRow } from "@/lib/queries/discovery";

/**
 * Single project tile in the /explore grid. Whole card is a link to the
 * project page; hover lifts the shadow. Stats are mono per design rule.
 */
export function ProjectCard({ project }: { project: PublicProjectRow }) {
  const initial = project.name.slice(0, 1).toUpperCase();
  return (
    <Link
      href={`/r/${project.slug}`}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-lg"
    >
      <Card
        depth="raised"
        padding="default"
        className={cn(
          "flex h-full flex-col gap-4 transition-shadow",
          "group-hover:shadow-floating",
        )}
      >
        <header className="flex items-start gap-3">
          <Avatar imageUrl={project.imageUrl} fallback={initial} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-headline-sm text-fg">
              {project.name}
            </h3>
            <div className="mt-0.5 flex items-center gap-1.5 text-mono-sm text-fg-muted">
              <Github className="size-3" />
              <span className="truncate">{project.slug}</span>
            </div>
          </div>
          <StatusBadge status={project.status} />
        </header>

        <p className="line-clamp-2 text-body-sm text-fg-secondary min-h-[34px]">
          {project.description ?? "No description provided."}
        </p>

        <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-3">
          <Stat label="Lifetime fees">
            <span className="text-mono-md text-fg">
              {formatSol(project.lifetimeFeesLamports, 2)}
            </span>
          </Stat>
          <Stat label="Daily fee">
            <span className="text-mono-md text-fg">
              {formatSol(project.dailyFeeLamports, 2)}
            </span>
          </Stat>
          <Stat label="Contributors">
            <span className="text-mono-md text-fg">
              {project.contributorsCount.toLocaleString("en-US")}
            </span>
          </Stat>
        </dl>
      </Card>
    </Link>
  );
}

function Avatar({
  imageUrl,
  fallback,
}: {
  imageUrl: string | null;
  fallback: string;
}) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={imageUrl}
        alt=""
        className="size-12 shrink-0 rounded-xl object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-headline-sm text-primary"
    >
      {fallback}
    </span>
  );
}

function StatusBadge({ status }: { status: PublicProjectRow["status"] }) {
  if (status === "live") {
    return (
      <Badge variant="success" size="sm" dot>
        Live
      </Badge>
    );
  }
  if (status === "paused") {
    return (
      <Badge variant="warning" size="sm">
        Paused
      </Badge>
    );
  }
  if (status === "killed") {
    return (
      <Badge variant="danger" size="sm">
        Killed
      </Badge>
    );
  }
  return (
    <Badge variant="default" size="sm">
      Draft
    </Badge>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-caption text-fg-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
