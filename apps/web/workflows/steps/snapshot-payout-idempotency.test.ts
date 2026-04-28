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

    const key = await recipientIdempotencyKey(
      "project_1",
      "2026-04-27",
      "contributor_1",
    );

    expect(key).toBe(
      await recipientIdempotencyKey("project_1", "2026-04-27", "contributor_1"),
    );
    expect(key).not.toBe(
      await recipientIdempotencyKey("project_1", "2026-04-28", "contributor_1"),
    );
    expect(key).not.toBe(
      await recipientIdempotencyKey("project_2", "2026-04-27", "contributor_1"),
    );
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
