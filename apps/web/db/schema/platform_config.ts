import {
  pgTable,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

/**
 * Key/value table for platform-wide tunables. Read by every workflow's
 * step 1 (kill_switch check). Updated only via super_admin actions, gated
 * by destructive-action wrapper.
 *
 * Reserved keys (enforced in app, not DB):
 *   - kill_switch.global         { enabled: boolean, reason?: string }
 *   - kill_switch.projects       { [projectId]: { enabled: true, reason?: string } }
 *   - fees.platform_bps          { value: number, updatedBy: string }
 *   - treasury.address           { value: string }
 *   - heartbeat.<workflow>       { lastBeatAt: ISO8601, runId?: string }
 *   - feature_flags              { [flag]: { enabled: boolean, cohorts?: string[] } }
 */
export const platformConfig = pgTable("platform_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
