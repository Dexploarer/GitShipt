import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const migration = readFileSync(
  join(process.cwd(), "db/migrations/0007_snapshot_period_idempotency.sql"),
  "utf8",
);

describe("snapshot/payout period idempotency", () => {
  it("derives snapshot periods from UTC days", async () => {
    const { snapshotPeriodKey } = await import("./snapshot-helpers");

    expect(snapshotPeriodKey("2026-04-27T23:59:59.999Z")).toBe("2026-04-27");
    expect(snapshotPeriodKey("2026-04-27T23:30:00-05:00")).toBe("2026-04-28");
  });

  it("keys recipients by project and snapshot period, not snapshot id", async () => {
    const { recipientIdempotencyKey } = await import("./payout-helpers");

    const key = recipientIdempotencyKey(
      "project_1",
      "2026-04-27",
      "contributor_1",
    );

    expect(key).toBe(
      recipientIdempotencyKey("project_1", "2026-04-27", "contributor_1"),
    );
    expect(key).not.toBe(
      recipientIdempotencyKey("project_1", "2026-04-28", "contributor_1"),
    );
    expect(key).not.toBe(
      recipientIdempotencyKey("project_2", "2026-04-27", "contributor_1"),
    );
  });

  it("keeps automated contributors ranked while marking their payout route", async () => {
    const { buildLeaderboardEntries } = await import(
      "@/lib/payouts/distribution"
    );

    const [entry] = buildLeaderboardEntries(
      [
        {
          id: "contributor_agent",
          ghUserId: "41898282",
          ghUsername: "github-actions[bot]",
          rank: 1,
          score: 10,
          payoutRoute: "treasury",
          payoutRouteReason: "treasury_routed_agent",
          inputs: {
            mergedPRs: 0,
            commits: 10,
            reviews: 0,
            issues: 0,
            netLines: 0,
          },
        },
      ],
      [1],
    );

    expect(entry).toMatchObject({
      contributorId: "contributor_agent",
      ghUsername: "github-actions[bot]",
      rank: 1,
      payoutRoute: "treasury",
      payoutRouteReason: "treasury_routed_agent",
      weight: 1,
    });
  });

  it("detects common agent contributors for treasury routing", async () => {
    const { isBot } = await import("@/lib/scoring/v0");
    const logins = [
      "claude",
      "claude-code",
      "cursor",
      "codex",
      "chatgpt",
      "perplexity",
      "github-actions[bot]",
      "copilot",
      "coderabbit",
      "renovate[bot]",
    ];

    for (const login of logins) {
      expect(isBot(login, [], [])).toBe(true);
    }
    expect(isBot("human-maintainer", [], [])).toBe(false);
    expect(isBot("codex", ["codex"], [])).toBe(false);
  });

  it("adds durable period columns and unique period guarantees", () => {
    expect(migration).toContain(
      'ALTER TABLE "snapshots" ADD COLUMN IF NOT EXISTS "snapshot_period" text',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "snapshots_project_period_active_uq"',
    );
    expect(migration).toContain(
      "WHERE \"status\" IN ('pending', 'frozen', 'paid')",
    );
    expect(migration).toContain(
      'ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "snapshot_period" text',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "payouts_project_snapshot_period_uq"',
    );
  });
});
