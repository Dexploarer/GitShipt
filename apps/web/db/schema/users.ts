import { pgEnum, pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createId } from "@repo/lib";

export const userRoleEnum = pgEnum("user_role", [
  "user",
  "moderator",
  "admin",
  "super_admin",
]);

/**
 * Combined user table for both better-auth (`name`, `email`, `emailVerified`,
 * `image`) and GitShipt domain fields (`githubId`, `githubUsername`, `role`,
 * `mfaSecretEnc`). better-auth's Drizzle adapter is configured to use this
 * table directly via field mapping in `lib/auth/index.ts`.
 */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),

    // better-auth required fields
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),

    // GitShipt domain fields
    githubId: text("github_id").unique(),
    githubUsername: text("github_username"),
    role: userRoleEnum("role").notNull().default("user"),
    mfaSecretEnc: text("mfa_secret_enc"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    githubUsernameIdx: index("users_github_username_idx").on(t.githubUsername),
    roleIdx: index("users_role_idx").on(t.role),
  }),
);

/**
 * better-auth session storage. Cookie-bound; rotated on sign-in.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdIdx: index("sessions_user_id_idx").on(t.userId),
  }),
);

/**
 * better-auth OAuth account links. One row per (provider, providerAccountId).
 */
export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdIdx: index("accounts_user_id_idx").on(t.userId),
    providerIdx: index("accounts_provider_idx").on(t.providerId, t.accountId),
  }),
);

/**
 * better-auth verification tokens (email, password reset, etc).
 */
export const verifications = pgTable("verifications", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
