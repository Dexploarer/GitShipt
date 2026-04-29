import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createId } from "@repo/lib";
import { users } from "./users";
import { projects } from "./projects";

export const pendingAdminActionStatusEnum = pgEnum(
  "pending_admin_action_status",
  ["pending", "approved", "completed", "failed", "expired"],
);

export interface PendingAdminActionPayloadJson {
  action: string;
  permission: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
}

/**
 * Cosign ledger for irreversible admin actions. The pending row is created
 * before the side effect runs; a different super_admin must approve it within
 * the expiry window before `destructiveAction()` executes the caller's body.
 */
export const pendingAdminActions = pgTable(
  "pending_admin_actions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    fingerprint: text("fingerprint").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: pendingAdminActionStatusEnum("status").notNull().default("pending"),
    action: text("action").notNull(),
    permission: text("permission").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    approverUserId: text("approver_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    reason: text("reason").notNull(),
    targetName: text("target_name").notNull(),
    payload: jsonb("payload").$type<PendingAdminActionPayloadJson>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    openFingerprintUq: uniqueIndex("pending_admin_actions_open_fingerprint_uq")
      .on(t.fingerprint)
      .where(sql`${t.status} = 'pending'`),
    statusIdx: index("pending_admin_actions_status_idx").on(t.status),
    actorIdx: index("pending_admin_actions_actor_idx").on(
      t.actorUserId,
      t.createdAt,
    ),
    targetIdx: index("pending_admin_actions_target_idx").on(
      t.targetType,
      t.targetId,
    ),
    expiresIdx: index("pending_admin_actions_expires_idx").on(t.expiresAt),
  }),
);
