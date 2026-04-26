import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projects } from "./projects";
import { users } from "./users";
import { createId } from "@repo/lib";

/**
 * Project-scoped API keys for programmatic access.
 *
 * The raw key is shown to the user EXACTLY ONCE at creation time. We persist:
 *   - `prefix`         (first 8 chars, e.g. "gbk_a1b2") — used for UI display
 *   - `hashedKey`      (SHA-256 of the raw key) — used for verification
 *   - `lastFourPlain`  (last 4 chars of raw key) — used to identify which key
 *
 * v0 supports `read` scope only; the `scopes` column exists so we can layer
 * fine-grained perms in v1.x without another migration.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    hashedKey: text("hashed_key").notNull(),
    lastFourPlain: text("last_four_plain").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    scopes: text("scopes")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => ({
    projectHashUq: uniqueIndex("api_keys_project_hash_uq").on(
      t.projectId,
      t.hashedKey,
    ),
    projectIdx: index("api_keys_project_idx").on(t.projectId),
  }),
);

export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type NewApiKeyRow = typeof apiKeys.$inferInsert;
