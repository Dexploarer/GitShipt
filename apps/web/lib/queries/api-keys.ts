import "server-only";
import crypto from "node:crypto";
import bs58 from "bs58";
import { and, desc, eq, isNull } from "drizzle-orm";
import { dbHttp } from "@/db";
import { apiKeys, type ApiKeyRow } from "@/db/schema";
import { cacheLife, cacheTag } from "next/cache";

import { cacheTags } from "@/lib/cache";
import {
  ProjectApiKeyScopesSchema,
  type ProjectApiKeyScope,
} from "@repo/shared";

/**
 * Project API key helpers. All callers must `requirePermission('project.update')`
 * for the target project before invoking — these helpers do not enforce
 * authorization themselves.
 *
 * Storage model:
 *   - The raw key is `gbk_<base58(32 random bytes)>` (~44+ chars total).
 *   - Only the SHA-256 hash is persisted in `hashed_key`.
 *   - `prefix` (first 8 chars) and `last_four_plain` (last 4 chars) are kept
 *     for UI display so users can identify keys without revealing them.
 *   - The raw key is returned EXACTLY ONCE from `createApiKey`.
 */

const KEY_PREFIX = "gbk_";
const KEY_BYTES = 32;

export interface ApiKeyListItem {
  id: string;
  name: string;
  prefix: string;
  lastFourPlain: string;
  scopes: ProjectApiKeyScope[];
  lastUsedAt: Date | null;
  createdAt: Date;
  createdByUserId: string;
}

export interface CreateApiKeyResult {
  /** Plain-text key. Returned ONCE; never persisted in plain form. */
  rawKey: string;
  row: ApiKeyRow;
}

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

function generateRawKey(): string {
  const bytes = crypto.randomBytes(KEY_BYTES);
  return `${KEY_PREFIX}${bs58.encode(bytes)}`;
}

/**
 * Create a new API key for a project. Returns the raw key (only time it is
 * ever readable) plus the persisted row.
 */
export async function createApiKey(
  projectId: string,
  name: string,
  createdByUserId: string,
  scopes: ProjectApiKeyScope[],
): Promise<CreateApiKeyResult> {
  const validatedScopes = ProjectApiKeyScopesSchema.parse(scopes);
  const rawKey = generateRawKey();
  const hashedKey = hashKey(rawKey);
  const prefix = rawKey.slice(0, 8);
  const lastFourPlain = rawKey.slice(-4);

  const [row] = await dbHttp
    .insert(apiKeys)
    .values({
      projectId,
      name,
      prefix,
      hashedKey,
      lastFourPlain,
      createdByUserId,
      scopes: validatedScopes,
    })
    .returning();

  if (!row) {
    throw new Error("api_key_insert_failed");
  }

  return { rawKey, row };
}

/**
 * List all non-revoked API keys for a project, newest first. The raw key
 * is never available here.
 */
async function listApiKeysForProjectUncached(
  projectId: string,
): Promise<ApiKeyListItem[]> {
  const rows = await dbHttp
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      lastFourPlain: apiKeys.lastFourPlain,
      scopes: apiKeys.scopes,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
      createdByUserId: apiKeys.createdByUserId,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.projectId, projectId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));
  return rows.map((row) => ({
    ...row,
    scopes: normalizeStoredScopes(row.scopes),
  }));
}

export async function listApiKeysForProject(
  projectId: string,
): Promise<ApiKeyListItem[]> {
  "use cache";
  cacheLife("auth");
  cacheTag(cacheTags.dashboard);
  cacheTag(cacheTags.dashboardProject(projectId));
  cacheTag(cacheTags.project(projectId));
  cacheTag(cacheTags.admin);
  return await listApiKeysForProjectUncached(projectId);
}

/**
 * Soft-revoke an API key. Sets `revokedAt` so it can no longer authenticate;
 * the row is kept for audit history.
 */
export async function revokeApiKey(
  keyId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _revokedByUserId: string,
): Promise<{ revoked: boolean; projectId: string | null }> {
  const [row] = await dbHttp
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), isNull(apiKeys.revokedAt)))
    .returning({ projectId: apiKeys.projectId });
  return { revoked: Boolean(row), projectId: row?.projectId ?? null };
}

/**
 * Lookup helper for future authentication middleware. Verifies a presented
 * raw key by hashing it and matching against `hashed_key`. Touches
 * `last_used_at` on success. Returns the row when valid + active.
 */
export async function verifyApiKey(rawKey: string): Promise<ApiKeyRow | null> {
  if (!rawKey.startsWith(KEY_PREFIX)) return null;
  const hashedKey = hashKey(rawKey);
  const [row] = await dbHttp
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.hashedKey, hashedKey), isNull(apiKeys.revokedAt)))
    .limit(1);
  if (!row) return null;
  await dbHttp
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id));
  return row;
}

function normalizeStoredScopes(scopes: string[] | null): ProjectApiKeyScope[] {
  const parsed = ProjectApiKeyScopesSchema.safeParse(scopes ?? []);
  if (parsed.success) return parsed.data;

  if ((scopes ?? []).includes("read")) {
    return ["read:project", "read:leaderboard", "read:payouts", "read:token"];
  }

  return ["read:leaderboard"];
}
