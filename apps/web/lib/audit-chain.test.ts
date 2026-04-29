import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  dbHttp: { execute: vi.fn() },
}));
vi.mock("@/db/schema", () => ({ auditLogs: {} }));
vi.mock("@/lib/observability", () => ({
  captureEvent: vi.fn(),
  captureException: vi.fn(),
}));

import { createHash } from "node:crypto";

import { canonicalAuditHashFromText } from "./audit-chain";

/**
 * The cron job re-derives every row's hash and compares against the stored
 * value, so the canonical function is the entire trust boundary. Lock its
 * shape with explicit fixtures.
 */
describe("canonicalAuditHashFromText", () => {
  it("produces a stable sha256 hex digest of the documented field order", () => {
    const hash = canonicalAuditHashFromText({
      id: "row-1",
      actorUserId: "user-1",
      action: "payout.execute",
      targetType: "payout",
      targetId: "p-1",
      metadataText: '{"amount": 1000, "ok": true}',
      ip: "1.2.3.4",
      userAgent: "ua/1.0",
      createdAtText: "2026-04-29 03:37:26.124+00",
      prevHash: "",
    });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes the canonical concatenation expected by Postgres' canonical fn", () => {
    // Hand-compute the same digest the migration's gitshipt_audit_canonical
    // emits and assert byte-for-byte parity. Any divergence between the JS
    // verifier and the Postgres trigger would invalidate the chain.
    const inputs = {
      id: "row-1",
      actorUserId: "user-1",
      action: "payout.execute",
      targetType: "payout",
      targetId: "p-1",
      metadataText: '{"amount": 1000, "ok": true}',
      ip: "1.2.3.4",
      userAgent: "ua/1.0",
      createdAtText: "2026-04-29 03:37:26.124+00",
      prevHash: "deadbeef",
    };
    const expected = createHash("sha256")
      .update(
        [
          inputs.prevHash,
          inputs.id,
          inputs.actorUserId,
          inputs.action,
          inputs.targetType,
          inputs.targetId,
          inputs.metadataText,
          inputs.ip,
          inputs.userAgent,
          inputs.createdAtText,
        ].join("|"),
        "utf8",
      )
      .digest("hex");
    expect(canonicalAuditHashFromText(inputs)).toBe(expected);
  });

  it("changes when any field changes", () => {
    const base = {
      id: "row-1",
      actorUserId: "user-1",
      action: "payout.execute",
      targetType: "payout",
      targetId: "p-1",
      metadataText: '{"amount": 1000}',
      ip: "1.2.3.4",
      userAgent: "ua/1.0",
      createdAtText: "2026-04-29 03:37:26.124+00",
      prevHash: "",
    };
    const a = canonicalAuditHashFromText(base);
    const b = canonicalAuditHashFromText({ ...base, action: "payout.cancel" });
    const c = canonicalAuditHashFromText({
      ...base,
      metadataText: '{"amount": 2000}',
    });
    const d = canonicalAuditHashFromText({ ...base, prevHash: "deadbeef" });
    expect(new Set([a, b, c, d]).size).toBe(4);
  });

  it("treats null fields as empty string except metadata which is 'null'", () => {
    const a = canonicalAuditHashFromText({
      id: "row-1",
      actorUserId: null,
      action: "x",
      targetType: "t",
      targetId: "tid",
      metadataText: "null",
      ip: null,
      userAgent: null,
      createdAtText: "2026-04-29 03:37:26+00",
      prevHash: "",
    });
    const b = canonicalAuditHashFromText({
      id: "row-1",
      actorUserId: "",
      action: "x",
      targetType: "t",
      targetId: "tid",
      metadataText: "null",
      ip: "",
      userAgent: "",
      createdAtText: "2026-04-29 03:37:26+00",
      prevHash: "",
    });
    expect(a).toBe(b);
  });
});
