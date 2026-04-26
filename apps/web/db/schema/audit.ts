import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createId } from "@repo/lib";

/**
 * Append-only audit log. Production DB role for the app must NOT have
 * UPDATE/DELETE permissions on this table — enforced at the Postgres
 * GRANT level. Insert-only enforces immutability.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    actorUserId: text("actor_user_id"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    actorIdx: index("audit_actor_idx").on(t.actorUserId, t.createdAt),
    actionIdx: index("audit_action_idx").on(t.action, t.createdAt),
    targetIdx: index("audit_target_idx").on(t.targetType, t.targetId),
  }),
);
