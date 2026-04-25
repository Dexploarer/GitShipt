import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Github } from "lucide-react";
import { TokenStatsRow } from "./TokenStatsRow";
import type { ProjectHeader as ProjectHeaderType } from "@/lib/queries/project-page";
import type { TokenStats } from "@/lib/queries/token-stats";

/**
 * Project hero — floats directly on the page bg (no card wrapper).
 * Avatar + name + description, then the inline TokenStatsRow strip
 * (price / cap / volume / holders / contract). Repo stats (language,
 * stars, forks, contributors) live in a sibling RepoStatsList on the
 * right side of the header in the page grid.
 */
export function ProjectHeader({
  header,
  tokenStats,
}: {
  header: ProjectHeaderType;
  tokenStats: TokenStats | null;
}) {
  const avatar = header.imageUrl ?? `https://github.com/${header.ghOwner}.png`;
  const repoUrl = `https://github.com/${header.ghOwner}/${header.ghRepo}`;

  return (
    <header className="flex min-w-0 flex-col gap-5 lg:gap-6">
      <div className="flex items-center gap-4 sm:gap-5 lg:gap-6">
        <Image
          src={avatar}
          alt=""
          width={112}
          height={112}
          className="size-20 shrink-0 rounded-2xl bg-surface-elevated ring-1 ring-border sm:size-24 lg:size-28"
          unoptimized
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="truncate text-[28px] font-semibold leading-tight tracking-[-0.02em] text-fg sm:text-[36px] lg:text-[44px]">
              {header.name}
            </h1>
            <Link
              href={repoUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`Open ${header.ghOwner}/${header.ghRepo} on GitHub`}
              className="inline-flex items-center gap-1 text-body-md text-fg-secondary transition-colors hover:text-fg lg:text-body-lg"
            >
              <Github className="size-4 lg:size-5" />
              {header.ghOwner}/{header.ghRepo}
              <ExternalLink className="size-3.5 lg:size-4" />
            </Link>
          </div>
          {header.description ? (
            <p className="mt-2 line-clamp-2 text-body-md text-fg-secondary lg:mt-2.5 lg:text-body-lg">
              {header.description}
            </p>
          ) : null}
        </div>
      </div>

      <TokenStatsRow
        stats={tokenStats}
        ghOwner={header.ghOwner}
        ghRepo={header.ghRepo}
      />
    </header>
  );
}
