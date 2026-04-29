import { describe, expect, it } from "vitest";

import type { LeaderboardEntry } from "@/db/schema";
import {
  buildPeriodDigestSubjects,
  PERIOD_DIGEST_TOP_N,
} from "./inputs";

function entry(rank: number, overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    contributorId: `c${rank}`,
    ghUsername: `user${rank}`,
    ghUserId: `gh${rank}`,
    rank,
    score: 100 - rank,
    weight: 1 / rank,
    inputs: {
      mergedPRs: 1,
      commits: 5,
      reviews: 2,
      issues: 0,
      netLines: 50,
      ...overrides.inputs,
    },
    ...overrides,
  };
}

describe("buildPeriodDigestSubjects", () => {
  it("captures snapshotId and period verbatim", () => {
    const subjects = buildPeriodDigestSubjects("snap_abc", "2026-04-29", []);
    expect(subjects.snapshotId).toBe("snap_abc");
    expect(subjects.period).toBe("2026-04-29");
  });

  it("returns zero totals and empty topContributors for an empty leaderboard", () => {
    const subjects = buildPeriodDigestSubjects("snap_x", "2026-04-29", []);
    expect(subjects.topContributors).toHaveLength(0);
    expect(subjects.totals).toEqual({
      contributors: 0,
      mergedPRs: 0,
      commits: 0,
      reviews: 0,
      issues: 0,
      netLines: 0,
    });
  });

  it("slices top N contributors in rank order", () => {
    const board = Array.from({ length: 10 }, (_, i) => entry(i + 1));
    const subjects = buildPeriodDigestSubjects("s", "p", board);
    expect(subjects.topContributors).toHaveLength(PERIOD_DIGEST_TOP_N);
    expect(subjects.topContributors.map((c) => c.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it("sums totals across the entire leaderboard, not just the top N", () => {
    const board = Array.from({ length: 8 }, (_, i) =>
      entry(i + 1, { inputs: { mergedPRs: 2, commits: 3, reviews: 1, issues: 1, netLines: 10 } }),
    );
    const subjects = buildPeriodDigestSubjects("s", "p", board);
    expect(subjects.totals).toEqual({
      contributors: 8,
      mergedPRs: 16,
      commits: 24,
      reviews: 8,
      issues: 8,
      netLines: 80,
    });
  });

  it("re-sorts an out-of-order leaderboard by rank before slicing", () => {
    const board = [entry(3), entry(1), entry(2), entry(5), entry(4)];
    const subjects = buildPeriodDigestSubjects("s", "p", board);
    expect(subjects.topContributors.map((c) => c.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it("preserves rank, score, weight, and inputs on each top contributor", () => {
    const subjects = buildPeriodDigestSubjects("s", "p", [
      entry(1, {
        ghUsername: "alice",
        score: 99.5,
        weight: 0.4,
        inputs: { mergedPRs: 7, commits: 12, reviews: 3, issues: 2, netLines: 850 },
      }),
    ]);
    expect(subjects.topContributors[0]).toEqual({
      ghUsername: "alice",
      rank: 1,
      score: 99.5,
      weight: 0.4,
      inputs: { mergedPRs: 7, commits: 12, reviews: 3, issues: 2, netLines: 850 },
    });
  });
});
