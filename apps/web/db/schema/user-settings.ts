import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  payoutEmails: boolean("payout_emails").notNull().default(true),
  securityEmails: boolean("security_emails").notNull().default(true),
  productEmails: boolean("product_emails").notNull().default(false),
  compactMode: boolean("compact_mode").notNull().default(false),
  defaultDashboardRoute: text("default_dashboard_route")
    .notNull()
    .default("/dashboard"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
