import { GitFork, Star, Users } from "lucide-react";
import type { ProjectHeader as ProjectHeaderType } from "@/lib/queries/project-page";

/**
 * Floating list of GitHub repo stats (language / stars / forks / contributors).
 * Lives on the right side of the project header — no card wrapper, just a
 * vertical list directly on the page bg, matching the "floating components"
 * direction (the page should feel composed of free-standing primitives, not
 * boxed-in modules).
 */
export function RepoStatsList({ header }: { header: ProjectHeaderType }) {
  return (
    <div className="flex flex-col">
      <div className="pb-2 text-caption uppercase tracking-wider text-fg-muted">
        Repository
      </div>

      <ul className="divide-y divide-border/40">
        <Row label="Language">
          {header.language ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ background: languageColor(header.language) }}
                aria-hidden
              />
              <span className="text-body-md text-fg">{header.language}</span>
            </span>
          ) : (
            <span className="text-body-md text-fg-muted">—</span>
          )}
        </Row>

        <Row label="Stars" icon={<Star className="size-3.5" />}>
          <span className="text-mono-md text-fg">
            {header.stars.toLocaleString("en-US")}
          </span>
        </Row>

        <Row label="Forks" icon={<GitFork className="size-3.5" />}>
          <span className="text-mono-md text-fg">
            {header.forks.toLocaleString("en-US")}
          </span>
        </Row>

        <Row label="Contributors" icon={<Users className="size-3.5" />}>
          <span className="text-mono-md text-fg">
            {header.contributorsCount.toLocaleString("en-US")}
          </span>
        </Row>
      </ul>
    </div>
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
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="inline-flex items-center gap-2 text-body-sm text-fg-secondary">
        {icon ? <span className="text-fg-muted">{icon}</span> : null}
        {label}
      </span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </li>
  );
}

const LANG_COLORS: Record<string, string> = {
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

function languageColor(lang: string): string {
  return LANG_COLORS[lang] ?? "#8b8b95";
}
