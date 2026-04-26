import {
  pgEnum,
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { createId } from "@repo/lib";

export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  // Bags metadata + fee-share config exist, but the final token launch
  // transaction has not been broadcast. Not eligible for payouts.
  "launch_configured",
  "live",
  "paused",
  "killed",
  // Project was "launched" in stub mode (no Bags credentials or no Solana
  // signer) — tokenMint / bagsLaunchId / bagsConfigKey are placeholders. A
  // real launch promotes this row by clearing those columns and setting
  // status back to 'draft' (see app/api/admin/promote-from-stub).
  "simulated_live",
]);

export const projectMemberRoleEnum = pgEnum("project_member_role", [
  "project_owner",
  "project_moderator",
]);

export interface ScoringConfig {
  formulaVersion: "v0" | "v1";
  windowDays: number;
  weights: {
    mergedPRs: number;
    commits: number;
    reviews: number;
    issues: number;
    netLines: number;
  };
  decay: "off" | "linear" | "exponential";
  botBlocklist: string[];
  botAllowlist: string[];
}

export interface PayoutConfig {
  topN: number;
  tierWeights: number[]; // must sum to 1.0
  claimThresholdLamports: number;
}

export const projects = pgTable(
  "projects",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    // GitHub
    ghOwner: text("gh_owner").notNull(),
    ghRepo: text("gh_repo").notNull(),
    ghRepoId: text("gh_repo_id").notNull(),
    ghInstallationId: text("gh_installation_id"),

    // Display
    name: text("name").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),

    // Bags / on-chain
    tokenMint: text("token_mint"),
    bagsLaunchId: text("bags_launch_id"),
    bagsConfigKey: text("bags_config_key"),
    bagsLaunchSignature: text("bags_launch_signature"),
    bagsLaunchWallet: text("bags_launch_wallet"),
    bagsPoolClaimerWallet: text("bags_pool_claimer_wallet"),
    bagsTokenMetadata: text("bags_token_metadata"),
    bagsInitialBuyLamports: integer("bags_initial_buy_lamports")
      .notNull()
      .default(0),
    tokenWebsiteUrl: text("token_website_url"),
    tokenTwitterUrl: text("token_twitter_url"),
    tokenTelegramUrl: text("token_telegram_url"),

    // Status + config
    status: projectStatusEnum("status").notNull().default("draft"),
    platformFeeBps: integer("platform_fee_bps").notNull().default(500),
    scoringConfig: jsonb("scoring_config").$type<ScoringConfig>().notNull(),
    payoutConfig: jsonb("payout_config").$type<PayoutConfig>().notNull(),

    pausedAt: timestamp("paused_at", { withTimezone: true }),
    pausedReason: text("paused_reason"),
    killedAt: timestamp("killed_at", { withTimezone: true }),
    /** Set when the project was launched in stub mode; null after a real launch. */
    simulatedAt: timestamp("simulated_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ghRepoUq: uniqueIndex("projects_gh_repo_uq").on(t.ghOwner, t.ghRepo),
    statusIdx: index("projects_status_idx").on(t.status),
    ownerIdx: index("projects_owner_idx").on(t.ownerUserId),
  }),
);

export const projectMemberships = pgTable(
  "project_memberships",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    role: projectMemberRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userProjectUq: uniqueIndex("memberships_user_project_uq").on(
      t.userId,
      t.projectId,
    ),
    projectIdx: index("memberships_project_idx").on(t.projectId),
  }),
);
