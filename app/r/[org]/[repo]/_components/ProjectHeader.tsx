import Image from "next/image";
import Link from "next/link";
import {
  ExternalLink,
  Github,
  GitFork,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { formatAddress } from "@/lib/format";
import type { ProjectHeader as ProjectHeaderType } from "@/lib/queries/project-page";

/**
 * Project hero — floating directly on the page bg (no card wrapper).
 * Avatar + name + repo link + description, then a row of QuickStat cards
 * (Language / Stars / Forks / Contributors / Token).
 *
 * The status pill is intentionally NOT rendered here — the footer + sidebar
 * status indicators carry that signal globally so the header stays clean.
 */
export function ProjectHeader({ header }: { header: ProjectHeaderType }) {
  const avatar = header.imageUrl ?? `https://github.com/${header.ghOwner}.png`;
  const repoUrl = `https://github.com/${header.ghOwner}/${header.ghRepo}`;
  const tokenSymbol = header.tokenMint
    ? header.ghRepo.toUpperCase().slice(0, 8)
    : null;

  return (
    <header className="flex min-w-0 flex-col gap-4">
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <QuickStat label="Language">
          {header.language ? (
            <>
              <span
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ background: languageColor(header.language) }}
                aria-hidden
              />
              <span className="truncate text-fg">{header.language}</span>
            </>
          ) : (
            <span className="text-fg-muted">—</span>
          )}
        </QuickStat>

        <QuickStat label="Stars">
          <Star className="size-3.5 text-fg-muted" />
          <span className="text-mono-md text-fg">
            {header.stars.toLocaleString("en-US")}
          </span>
        </QuickStat>

        <QuickStat label="Forks">
          <GitFork className="size-3.5 text-fg-muted" />
          <span className="text-mono-md text-fg">
            {header.forks.toLocaleString("en-US")}
          </span>
        </QuickStat>

        <QuickStat label="Contributors">
          <Users className="size-3.5 text-fg-muted" />
          <span className="text-mono-md text-fg">
            {header.contributorsCount.toLocaleString("en-US")}
          </span>
        </QuickStat>

        <QuickStat label="Token">
          {tokenSymbol ? (
            <>
              <span className="grid size-4 shrink-0 place-items-center rounded-md bg-primary text-bg">
                <Sparkles className="size-2.5" />
              </span>
              <span className="text-label-md text-fg" title={header.tokenMint ?? undefined}>
                {tokenSymbol}
              </span>
            </>
          ) : (
            <span className="text-mono-sm text-fg-muted">
              {header.tokenMint ? formatAddress(header.tokenMint) : "—"}
            </span>
          )}
        </QuickStat>
      </div>
    </header>
  );
}

function QuickStat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface/40 px-3 py-2">
      <div className="text-caption text-fg-muted">{label}</div>
      <div className="mt-1 flex min-w-0 items-center gap-1.5">{children}</div>
    </div>
  );
}

/**
 * GitHub-style language color map. Tiny subset — extend as needed; falls
 * back to a neutral gray for unknown languages.
 */
function languageColor(lang: string): string {
  const map: Record<string, string> = {
    TypeScript: "#3178c6",
    JavaScript: "#f1e05a",
    Python: "#3572A5",
    Go: "#00ADD8",
    Rust: "#dea584",
    Solidity: "#AA6746",
    Java: "#b07219",
    Ruby: "#701516",
    Swift: "#F05138",
    Kotlin: "#A97BFF",
    C: "#555555",
    "C++": "#f34b7d",
    "C#": "#178600",
    Shell: "#89e051",
    HTML: "#e34c26",
    CSS: "#563d7c",
    Vue: "#41b883",
    Svelte: "#ff3e00",
    Dart: "#00B4AB",
  };
  return map[lang] ?? "#8b8b95";
}
