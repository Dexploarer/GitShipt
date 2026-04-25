import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Github, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAddress } from "@/lib/format";
import type { ProjectHeader as ProjectHeaderType } from "@/lib/queries/project-page";

const STATUS_PILL: Record<ProjectHeaderType["status"], string> = {
  live: "bg-success-soft text-success",
  paused: "bg-warning-soft text-warning",
  killed: "bg-danger-soft text-danger",
  draft: "bg-primary-soft text-primary",
};

const STATUS_LABEL: Record<ProjectHeaderType["status"], string> = {
  live: "Live",
  paused: "Paused",
  killed: "Killed",
  draft: "Draft",
};

/**
 * Project hero card. Avatar + name + repo link + description on the left,
 * stat chips along the bottom. The status chip is the only colored element;
 * everything else stays muted so the right-column "Daily Fee Pool" remains
 * the single primary-purple anchor on the page.
 */
export function ProjectHeader({ header }: { header: ProjectHeaderType }) {
  const avatar =
    header.imageUrl ?? `https://github.com/${header.ghOwner}.png`;
  const repoUrl = `https://github.com/${header.ghOwner}/${header.ghRepo}`;

  return (
    <section className="flex h-full flex-col rounded-lg border border-border bg-surface p-6">
      <div className="flex items-start gap-4">
        <Image
          src={avatar}
          alt=""
          width={56}
          height={56}
          className="size-14 shrink-0 rounded-full bg-surface-elevated"
          unoptimized
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="truncate text-headline-md text-fg">{header.name}</h1>
            <Link
              href={repoUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`Open ${header.ghOwner}/${header.ghRepo} on GitHub`}
              className="inline-flex items-center gap-1 text-body-sm text-fg-secondary transition-colors hover:text-fg"
            >
              <Github className="size-4" />
              {header.ghOwner}/{header.ghRepo}
              <ExternalLink className="size-3" />
            </Link>
          </div>
          {header.description ? (
            <p className="mt-2 line-clamp-2 text-body-md text-fg-secondary">
              {header.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label-sm",
            STATUS_PILL[header.status],
          )}
        >
          <span className="size-1.5 animate-pulse-dot rounded-full bg-current" />
          {STATUS_LABEL[header.status]}
        </span>

        <Chip>
          <Users className="size-3.5" />
          <span>{header.contributorsCount} contributors</span>
        </Chip>

        {header.tokenMint ? (
          <Chip>
            <span className="size-1.5 rounded-full bg-success" />
            <span className="text-fg-secondary">Token</span>
            <span className="text-mono-sm text-fg">
              {formatAddress(header.tokenMint)}
            </span>
          </Chip>
        ) : (
          <Chip>
            <span className="size-1.5 rounded-full bg-fg-muted" />
            <span>No token launched</span>
          </Chip>
        )}
      </div>
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-2.5 py-1 text-label-sm text-fg-secondary">
      {children}
    </span>
  );
}
