import { describe, expect, it } from "vitest";

import type { PeriodDigestSubjects } from "@/db/schema";
import { renderPeriodDigestMarkdown } from "./templates";

function subjects(overrides: Partial<PeriodDigestSubjects> = {}): PeriodDigestSubjects {
  return {
    snapshotId: "snap_x",
    period: "2026-04-29",
    topContributors: [],
    totals: {
      contributors: 0,
      mergedPRs: 0,
      commits: 0,
      reviews: 0,
      issues: 0,
      netLines: 0,
    },
    ...overrides,
  };
}

describe("renderPeriodDigestMarkdown", () => {
  it("uses display name when present, falls back to slug", () => {
    const md1 = renderPeriodDigestMarkdown(
      { slug: "octo/cat", name: "OctoCat Studio" },
      subjects(),
    );
    expect(md1).toMatch(/^# OctoCat Studio · 2026-04-29\b/);

    const md2 = renderPeriodDigestMarkdown(
      { slug: "octo/cat", name: null },
      subjects(),
    );
    expect(md2).toMatch(/^# octo\/cat · 2026-04-29\b/);
  });

  it("renders contributor count + activity when populated", () => {
    const md = renderPeriodDigestMarkdown(
      { slug: "x/y", name: null },
      subjects({
        totals: {
          contributors: 5,
          mergedPRs: 8,
          commits: 24,
          reviews: 3,
          issues: 0,
          netLines: 0,
        },
      }),
    );
    expect(md).toContain("**5 contributors** active");
    expect(md).toContain("**8 merged PRs**");
    expect(md).toContain("24 commits");
    expect(md).toContain("3 reviews");
    // 0 issues line should NOT appear — skip empty signals.
    expect(md).not.toContain("0 issue");
  });

  it("singularizes counts of 1", () => {
    const md = renderPeriodDigestMarkdown(
      { slug: "x/y", name: null },
      subjects({
        totals: {
          contributors: 1,
          mergedPRs: 1,
          commits: 1,
          reviews: 1,
          issues: 1,
          netLines: 0,
        },
      }),
    );
    expect(md).toContain("**1 contributor** active");
    expect(md).toContain("**1 merged PR**");
    expect(md).toContain("1 commit");
    expect(md).toContain("1 review");
    expect(md).toContain("1 issue");
    // No trailing 's' on these singular forms.
    expect(md).not.toContain("1 contributors");
    expect(md).not.toContain("1 merged PRs");
  });

  it("renders signed net lines only when non-zero", () => {
    const positive = renderPeriodDigestMarkdown(
      { slug: "x/y", name: null },
      subjects({
        totals: {
          contributors: 1,
          mergedPRs: 0,
          commits: 0,
          reviews: 0,
          issues: 0,
          netLines: 1234,
        },
      }),
    );
    expect(positive).toContain("**+1,234 lines**");

    const zero = renderPeriodDigestMarkdown(
      { slug: "x/y", name: null },
      subjects(),
    );
    expect(zero).not.toContain("lines");

    const negative = renderPeriodDigestMarkdown(
      { slug: "x/y", name: null },
      subjects({
        totals: {
          contributors: 1,
          mergedPRs: 0,
          commits: 0,
          reviews: 0,
          issues: 0,
          netLines: -150,
        },
      }),
    );
    expect(negative).toContain("**-150 lines**");
  });

  it("skips Top contributors section when empty", () => {
    const md = renderPeriodDigestMarkdown(
      { slug: "x/y", name: null },
      subjects(),
    );
    expect(md).not.toContain("Top contributors");
  });

  it("renders ranked top contributors with detail tail", () => {
    const md = renderPeriodDigestMarkdown(
      { slug: "x/y", name: null },
      subjects({
        topContributors: [
          {
            ghUsername: "alice",
            rank: 1,
            score: 99.5,
            weight: 0.4,
            inputs: { mergedPRs: 3, commits: 12, reviews: 0, issues: 0, netLines: 200 },
          },
          {
            ghUsername: "bob",
            rank: 2,
            score: 87,
            weight: 0.3,
            inputs: { mergedPRs: 1, commits: 4, reviews: 5, issues: 0, netLines: 80 },
          },
        ],
      }),
    );
    expect(md).toContain("## Top contributors");
    expect(md).toMatch(/1\. \*\*@alice\*\* — score 100 \(3 PRs, 12 commits\)/);
    expect(md).toMatch(/2\. \*\*@bob\*\* — score 87 \(1 PR, 4 commits, 5 reviews\)/);
  });

  it("ends with a single trailing newline (stable diff)", () => {
    const md = renderPeriodDigestMarkdown(
      { slug: "x/y", name: null },
      subjects(),
    );
    expect(md.endsWith("\n")).toBe(true);
    expect(md.endsWith("\n\n")).toBe(false);
  });
});
