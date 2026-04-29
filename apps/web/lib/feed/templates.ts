/**
 * Deterministic markdown templates for project_feed_entries.body_md.
 *
 * Templates are pure string builders — no I/O, no React. The rendered
 * markdown is the canonical narrative for ATOM/RSS readers, search
 * indexers, and anywhere we need prose without booting the React
 * renderer. The structured `subjects` payload is what the React feed
 * cards actually render.
 *
 * Keep these terse. Cards are scanned, not read. If a contributor wants
 * the long form they click through to /r/[org]/[repo].
 */

import type { PeriodDigestSubjects } from "@/db/schema";

export interface ProjectContext {
  /** "org/repo" — used in the H1 of the digest card. */
  slug: string;
  /** Display name from projects.name. Falls back to slug when null. */
  name: string | null;
}

/**
 * Render a `period_digest` card body.
 *
 * Format:
 *
 *   # {project name} · {period}
 *
 *   - **{N} contributors** active
 *   - **{X} merged PRs** · {Y} commits · {Z} reviews
 *
 *   ## Top contributors
 *
 *   1. **@user1** — score 99 (3 PRs, 12 commits)
 *   2. **@user2** — score 85 (2 PRs, 8 commits)
 *   ...
 *
 * Skip empty stat lines (e.g., "0 reviews" reads as noise on small
 * repos). Output is stable across runs given the same inputs.
 */
export function renderPeriodDigestMarkdown(
  ctx: ProjectContext,
  subjects: PeriodDigestSubjects,
): string {
  const lines: string[] = [];
  const heading = ctx.name ?? ctx.slug;
  lines.push(`# ${heading} · ${subjects.period}`);
  lines.push("");

  const t = subjects.totals;
  const contribLine = pluralize(t.contributors, "contributor", "contributors");
  const activityParts: string[] = [];
  if (t.mergedPRs > 0) {
    activityParts.push(`**${t.mergedPRs} merged PR${t.mergedPRs === 1 ? "" : "s"}**`);
  }
  if (t.commits > 0) {
    activityParts.push(`${t.commits} commit${t.commits === 1 ? "" : "s"}`);
  }
  if (t.reviews > 0) {
    activityParts.push(`${t.reviews} review${t.reviews === 1 ? "" : "s"}`);
  }
  if (t.issues > 0) {
    activityParts.push(`${t.issues} issue${t.issues === 1 ? "" : "s"}`);
  }

  lines.push(`- **${contribLine}** active`);
  if (activityParts.length > 0) {
    lines.push(`- ${activityParts.join(" · ")}`);
  }
  if (t.netLines !== 0) {
    const sign = t.netLines >= 0 ? "+" : "";
    lines.push(`- **${sign}${t.netLines.toLocaleString("en-US")} lines** net`);
  }
  lines.push("");

  if (subjects.topContributors.length > 0) {
    lines.push("## Top contributors");
    lines.push("");
    for (const c of subjects.topContributors) {
      const detail: string[] = [];
      if (c.inputs.mergedPRs > 0) detail.push(`${c.inputs.mergedPRs} PR${c.inputs.mergedPRs === 1 ? "" : "s"}`);
      if (c.inputs.commits > 0) detail.push(`${c.inputs.commits} commit${c.inputs.commits === 1 ? "" : "s"}`);
      if (c.inputs.reviews > 0) detail.push(`${c.inputs.reviews} review${c.inputs.reviews === 1 ? "" : "s"}`);
      const detailStr = detail.length > 0 ? ` (${detail.join(", ")})` : "";
      lines.push(
        `${c.rank}. **@${c.ghUsername}** — score ${formatScoreCompact(c.score)}${detailStr}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

function pluralize(n: number, singular: string, plural: string): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? singular : plural}`;
}

/**
 * Score is a float; the leaderboard renders it as an integer with
 * thousands separators. Mirror that for narrative bodies so prose
 * matches the leaderboard cell.
 */
function formatScoreCompact(score: number): string {
  if (!Number.isFinite(score)) return "0";
  return Math.round(score).toLocaleString("en-US");
}
