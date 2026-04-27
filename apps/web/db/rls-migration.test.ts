import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(process.cwd(), "db/migrations/0005_rls_hardening.sql"),
  "utf8",
);

const protectedTables = [
  "users",
  "sessions",
  "accounts",
  "verifications",
  "wallets",
  "projects",
  "project_memberships",
  "contributors",
  "contributor_claims",
  "snapshots",
  "payouts",
  "payout_recipients",
  "escrow_holdings",
  "api_keys",
  "gh_indexer_state",
  "platform_config",
  "webhooks_inbox",
  "audit_logs",
] as const;

describe("RLS hardening migration", () => {
  it("enables row level security on every application table", () => {
    for (const table of protectedTables) {
      expect(migration).toContain(
        `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`,
      );
    }
  });

  it("defines policy coverage for every protected table", () => {
    for (const table of protectedTables) {
      expect(migration).toMatch(
        new RegExp(`CREATE POLICY [\\s\\S]+ ON ${table}\\b`),
      );
    }
  });

  it("keeps audit logs append-only through RLS", () => {
    expect(migration).toContain("CREATE POLICY audit_no_update ON audit_logs");
    expect(migration).toContain("CREATE POLICY audit_no_delete ON audit_logs");
    expect(migration).toContain("USING (false)");
    expect(migration).toContain("WITH CHECK (false)");
  });
});
