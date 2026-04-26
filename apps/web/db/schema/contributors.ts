import {
  pgTable,
  text,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { projects } from "./projects";
import { createId } from "@repo/lib";

export interface ContributorScoreInputs {
  mergedPRs: number;
  commits: number;
  reviews: number;
  issues: number;
  netLines: number;
}

/**
 * Per-project, per-GitHub-user score row. Materialized by
 * `computeLeaderboard` workflow; rank is recomputed each pass.
 */
export const contributors = pgTable(
  "contributors",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    ghUserId: text("gh_user_id").notNull(),
    ghUsername: text("gh_username").notNull(),
    avatarUrl: text("avatar_url"),
    score: doublePrecision("score").notNull().default(0),
    rank: integer("rank"),
    inputs: jsonb("inputs").$type<ContributorScoreInputs>().notNull().default({
      mergedPRs: 0,
      commits: 0,
      reviews: 0,
      issues: 0,
      netLines: 0,
    } satisfies ContributorScoreInputs),
    excluded: text("excluded").default("false").notNull(), // text bool: 'true'|'false'
    excludedReason: text("excluded_reason"),
    lastIndexedAt: timestamp("last_indexed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    projectGhUq: uniqueIndex("contributors_project_gh_uq").on(t.projectId, t.ghUserId),
    rankIdx: index("contributors_project_rank_idx").on(t.projectId, t.rank),
    ghUsernameIdx: index("contributors_gh_username_idx").on(t.ghUsername),
  }),
);

/**
 * Wallet-link state for a contributor. `userId` and `walletAddress` are
 * filled when the contributor signs in and proves wallet ownership.
 */
export const contributorClaims = pgTable(
  "contributor_claims",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    walletAddress: text("wallet_address"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    contributorUq: uniqueIndex("claims_contributor_uq").on(t.contributorId),
  }),
);
