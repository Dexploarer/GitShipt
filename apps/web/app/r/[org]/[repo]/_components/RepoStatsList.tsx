import { GitFork, Star, Users } from "lucide-react";
import type { ProjectHeader as ProjectHeaderType } from "@/lib/queries/project-page";
import { languageColor } from "@repo/lib";

/**
 * Floating list of GitHub repo stats (language / stars / forks / contributors).
 * Lives on the right side of the project header — no card wrapper, just a
 * vertical list directly on the page bg, matching the "floating components"
 * direction (the page should feel composed of free-standing primitives, not
 * boxed-in modules).
 */
export function RepoStatsList({ header }: { header: ProjectHeaderType }) {
  // Compact list anchored to the top of its grid cell. Pure stats — the
  // Share menu now lives inside ProjectHeader (top-right of the avatar row).
  return (
    <ul className="flex flex-col gap-1 self-start">
      <Row label="Language">
        {header.language ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block size-2 shrink-0 rounded-full"
              style={{ background: languageColor(header.language) }}
              aria-hidden
            />
            <span className="text-body-sm text-fg">{header.language}</span>
          </span>
        ) : (
          <span className="text-body-sm text-fg-muted">—</span>
        )}
      </Row>

      <Row label="Stars" icon={<Star className="size-3" />}>
        <span className="text-mono-sm text-fg">
          {header.stars.toLocaleString("en-US")}
        </span>
      </Row>

      <Row label="Forks" icon={<GitFork className="size-3" />}>
        <span className="text-mono-sm text-fg">
          {header.forks.toLocaleString("en-US")}
        </span>
      </Row>

      <Row label="Contributors" icon={<Users className="size-3" />}>
        <span className="text-mono-sm text-fg">
          {header.contributorsCount.toLocaleString("en-US")}
        </span>
      </Row>
    </ul>
  );
}

function Row({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-body-sm text-fg-secondary">
        {icon ? <span className="text-fg-muted">{icon}</span> : null}
        {label}
      </span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </li>
  );
}
