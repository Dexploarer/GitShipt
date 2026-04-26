import { pgTable, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { createId } from "@repo/lib";

/**
 * SIWS-verified wallet links. One user can have multiple wallets;
 * (user_id, address) is unique to prevent duplicates.
 */
export const wallets = pgTable(
  "wallets",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    address: text("address").notNull(),
    chain: text("chain").notNull().default("solana"),
    label: text("label"),
    isPrimary: text("is_primary").default("false").notNull(), // text bool for compat with better-auth-style flags
    verifiedAt: timestamp("verified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userAddressUq: uniqueIndex("wallets_user_address_uq").on(t.userId, t.address),
    addressIdx: index("wallets_address_idx").on(t.address),
  }),
);
