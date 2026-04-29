import "server-only";

import { createHash } from "node:crypto";

import { dbHttp } from "@/db";
import { sql } from "drizzle-orm";
import { captureEvent, captureException } from "@/lib/observability";

export interface AuditChainBreak {
  rowId: string;
  reason: "prev_hash_mismatch" | "entry_hash_mismatch";
  expectedPrevHash: string;
  actualPrevHash: string;
  expectedEntryHash: string;
  actualEntryHash: string;
}

export interface AuditChainResult {
  rowsChecked: number;
  breaks: AuditChainBreak[];
  ok: boolean;
}

/**
 * Recomputes the audit-log hash chain in the application layer and compares
 * each row's stored prev_hash and entry_hash against the values the chain
 * implies. Mirrors the Postgres `gitshipt_audit_canonical` function exactly.
 *
 * Inserts in audit_logs are serialized through a Postgres advisory lock, so
 * the chain is total: a discrepancy implies tampering, replication drift, or
 * a bug in the canonical function. All three are alert-worthy.
 *
 * Verification reads the table in chunks of `batchSize` (default 500) so we
 * do not buffer the entire log in memory; the chain is processed
 * sequentially since each step depends on the previous one.
 */
export async function verifyAuditChain(
  options: { batchSize?: number; limit?: number } = {},
): Promise<AuditChainResult> {
  const batchSize = options.batchSize ?? 500;
  const limit = options.limit;
  const breaks: AuditChainBreak[] = [];
  let prevEntryHash = "";
  let cursor: { createdAt: Date; id: string } | null = null;
  let rowsChecked = 0;

  interface AuditChainRow {
    id: string;
    actor_user_id: string | null;
    action: string;
    target_type: string;
    target_id: string;
    ip: string | null;
    user_agent: string | null;
    prev_hash: string;
    entry_hash: string;
    created_at: Date | string;
    created_at_text: string;
    metadata_text: string;
  }

  while (true) {
    // Read the canonical Postgres-formatted timestamp text alongside the row
    // so the verifier hashes the exact string the trigger hashed. Going
    // through a JS Date round-trip would lose microsecond precision and
    // produce false-positive breaks for rows defaulted via `now()`.
    const cursorClause = cursor
      ? sql`WHERE (created_at, id) > (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id})`
      : sql``;
    const result = (await dbHttp.execute(sql`
      SELECT
        id, actor_user_id, action, target_type, target_id,
        ip, user_agent, prev_hash, entry_hash, created_at,
        created_at::text AS created_at_text,
        metadata::text AS metadata_text
      FROM audit_logs
      ${cursorClause}
      ORDER BY created_at ASC, id ASC
      LIMIT ${batchSize}
    `)) as unknown;

    const list: AuditChainRow[] = Array.isArray(result)
      ? (result as AuditChainRow[])
      : Array.isArray((result as { rows?: unknown }).rows)
        ? ((result as { rows: AuditChainRow[] }).rows)
        : [];

    if (list.length === 0) break;

    for (const r of list) {
      const expectedPrev = prevEntryHash;
      const expectedEntry = canonicalAuditHashFromText({
        id: r.id,
        actorUserId: r.actor_user_id,
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        metadataText: r.metadata_text,
        ip: r.ip,
        userAgent: r.user_agent,
        createdAtText: r.created_at_text,
        prevHash: expectedPrev,
      });
      const row = {
        id: r.id,
        prevHash: r.prev_hash,
        entryHash: r.entry_hash,
        createdAt:
          r.created_at instanceof Date
            ? r.created_at
            : new Date(r.created_at),
      };

      if (row.prevHash !== expectedPrev) {
        breaks.push({
          rowId: row.id,
          reason: "prev_hash_mismatch",
          expectedPrevHash: expectedPrev,
          actualPrevHash: row.prevHash,
          expectedEntryHash: expectedEntry,
          actualEntryHash: row.entryHash,
        });
      } else if (row.entryHash !== expectedEntry) {
        breaks.push({
          rowId: row.id,
          reason: "entry_hash_mismatch",
          expectedPrevHash: expectedPrev,
          actualPrevHash: row.prevHash,
          expectedEntryHash: expectedEntry,
          actualEntryHash: row.entryHash,
        });
      }

      // Even on a break we keep walking against the *recomputed* expected
      // hash so we don't double-report every subsequent row as broken.
      prevEntryHash = expectedEntry;
      cursor = { createdAt: row.createdAt, id: row.id };
      rowsChecked += 1;

      if (limit !== undefined && rowsChecked >= limit) {
        return { rowsChecked, breaks, ok: breaks.length === 0 };
      }
    }

    if (list.length < batchSize) break;
  }

  return { rowsChecked, breaks, ok: breaks.length === 0 };
}

interface CanonicalInput {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  /** Postgres' `metadata::text` rendering — already canonicalized server-side. */
  metadataText: string;
  ip: string | null;
  userAgent: string | null;
  /** Postgres' `created_at::text` rendering — already canonicalized server-side. */
  createdAtText: string;
  prevHash: string;
}

/**
 * MUST match `gitshipt_audit_canonical` in migration 0015 byte-for-byte.
 *
 * Field order:
 *   prev_hash | id | actor_user_id | action | target_type | target_id |
 *   metadata::text | ip | user_agent | created_at::text
 *
 * The text-form fields (metadata::text, created_at::text) are read directly
 * from Postgres in `verifyAuditChain` so we don't have to re-implement
 * Postgres' jsonb / timestamptz formatting in JS — that would mean
 * shadowing microsecond precision, key-ordering rules, NaN / -0 handling,
 * and any future Postgres formatting quirk.
 */
export function canonicalAuditHashFromText(input: CanonicalInput): string {
  const parts = [
    input.prevHash ?? "",
    input.id ?? "",
    input.actorUserId ?? "",
    input.action ?? "",
    input.targetType ?? "",
    input.targetId ?? "",
    input.metadataText ?? "null",
    input.ip ?? "",
    input.userAgent ?? "",
    input.createdAtText ?? "",
  ];
  return createHash("sha256").update(parts.join("|"), "utf8").digest("hex");
}

/**
 * Cron-friendly entry. Walks the chain, emits a structured event with the
 * count of rows checked, and surfaces every break to the observability sink
 * so an alerting rule can fire on tamper.
 */
export async function runAuditChainVerification(): Promise<AuditChainResult> {
  try {
    const result = await verifyAuditChain();
    captureEvent("audit.chain.verify", {
      area: "audit.chain",
      severity: result.ok ? "info" : "fatal",
      tags: { ok: String(result.ok) },
      extra: {
        rowsChecked: result.rowsChecked,
        breakCount: result.breaks.length,
        firstBreak: result.breaks[0],
      },
    });
    return result;
  } catch (err) {
    captureException(err, { area: "audit.chain.verify", severity: "error" });
    throw err;
  }
}
