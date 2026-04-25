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
 * Project hero — floating: lives directly on the page bg, no card wrapper.
 * Left: avatar + name + repo link + description + status/stat chips.
 * Vertical padding kept tight so the page scrolls less above the fold.
 */
export function ProjectHeader({ header }: { header: ProjectHeaderType }) {
  const avatar = header.imageUrl ?? `https://github.com/${header.ghOwner}.png`;
  const repoUrl = `https://github.com/${header.ghOwner}/${header.ghRepo}`;

  return (
    <header className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-3">
        <Image
          src={avatar}
          alt=""
          width={44}
          height={44}
          className="size-11 shrink-0 rounded-full bg-surface-elevated ring-1 ring-border"
          unoptimized
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h1 className="truncate text-headline-md leading-tight text-fg">
              {header.name}
            </h1>
            <Link
              href={repoUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`Open ${header.ghOwner}/${header.ghRepo} on GitHub`}
              className="inline-flex items-center gap-1 text-body-sm text-fg-secondary transition-colors hover:text-fg"
            >
              <Github className="size-3.5" />
              {header.ghOwner}/{header.ghRepo}
              <ExternalLink className="size-3" />
            </Link>
          </div>
          {header.description ? (
            <p className="mt-1 line-clamp-2 text-body-sm text-fg-secondary">
              {header.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-label-sm",
            STATUS_PILL[header.status],
          )}
        >
          <span className="size-1.5 animate-pulse-dot rounded-full bg-current" />
          {STATUS_LABEL[header.status]}
        </span>

        <Chip>
          <Users className="size-3" />
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
    </header>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface-elevated/40 px-2 py-0.5 text-label-sm text-fg-secondary">
      {children}
    </span>
  );
}
