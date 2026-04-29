import {
  pgEnum,
  pgTable,
  text,
  integer,
  boolean,
  doublePrecision,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { projects } from "./projects";
import { createId } from "@repo/lib";

/**
 * CI-driven inputs for a contributor in a window. Populated by the CI ingest
 * endpoint (shipshape design doc §10) and read by alignment computation (§8.1).
 */
export interface ContributorCiInputs {
  prsTotal: number;
  prsGreenOnFirstPush: number;
  /** Basis points; positive = added coverage. */
  coverageDeltaBp: number;
  /** Bytes; negative = shrunk bundle. */
  bundleDeltaBytes: number;
  /** Basis points; sign per project's "lower-is-better" hint. */
  perfDeltaBp: number;
  vulnsIntroduced: number;
  vulnsEliminated: number;
  /** PRs merged then reverted in window. */
  brokeMain: number;
}

export interface ContributorScoreInputs {
  // v0 fields — always populated
  mergedPRs: number;
  commits: number;
  reviews: number;
  issues: number;
  netLines: number;
  // v1 additions (shipshape design doc §5.1) — optional during transition.
  // The DB column carries the full default object so missing TS fields
  // resolve to 0 / empty-ci on insert. v0 callers keep working unchanged;
  // v1 callers populate everything.
  /** Count of *others'* PRs the contributor approved-and-merged. */
  merges?: number;
  /** Length + anchor density + suggestion count, summed. */
  reviewSubstantiveScore?: number;
  /** Commits where contributor appears in Co-authored-by trailer. */
  coAuthored?: number;
  ci?: ContributorCiInputs;
}

/**
 * Attribution model for the contributor row. Defined in shipshape design
 * doc §5.6.
 *  - human:            normal user, earns directly
 *  - agent_routed:     bot account whose earnings forward to operator
 *                      (routesToContributorId). Operator binding lives in
 *                      projects.agentRoutingPolicy.
 *  - bot_treasury:     bot whose earnings go to the project treasury
 *  - agent_unrouted:   bot detected but no policy yet; earnings held
 */
export const contributorAttributionTypeEnum = pgEnum(
  "contributor_attribution_type",
  ["human", "agent_routed", "bot_treasury", "agent_unrouted"],
);

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
      merges: 0,
      reviewSubstantiveScore: 0,
      coAuthored: 0,
      ci: {
        prsTotal: 0,
        prsGreenOnFirstPush: 0,
        coverageDeltaBp: 0,
        bundleDeltaBytes: 0,
        perfDeltaBp: 0,
        vulnsIntroduced: 0,
        vulnsEliminated: 0,
        brokeMain: 0,
      },
    } satisfies ContributorScoreInputs),
    excluded: text("excluded").default("false").notNull(), // text bool: 'true'|'false'
    excludedReason: text("excluded_reason"),
    /** Attribution model for earnings routing. See §5.6 / §6.1 of shipshape. */
    attributionType: contributorAttributionTypeEnum("attribution_type")
      .notNull()
      .default("human"),
    /** Soft FK to the operator's contributor row in the same project when
     *  attributionType = agent_routed. Resolved at payout time. */
    routesToContributorId: text("routes_to_contributor_id"),
    /** Community verification flag (shipshape design doc §6.7). True when a
     *  maintainer with triage+ has run /gitshipt verify-community on this
     *  contributor for this project. Optionally gates payout above
     *  payoutConfig.communityVerifiedThresholdLamports. */
    communityVerified: boolean("community_verified").notNull().default(false),
    communityVerifiedBy: text("community_verified_by"),
    communityVerifiedAt: timestamp("community_verified_at", {
      withTimezone: true,
    }),
    lastIndexedAt: timestamp("last_indexed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    projectGhUq: uniqueIndex("contributors_project_gh_uq").on(t.projectId, t.ghUserId),
    rankIdx: index("contributors_project_rank_idx").on(t.projectId, t.rank),
    ghUsernameIdx: index("contributors_gh_username_idx").on(t.ghUsername),
    attributionIdx: index("contributors_attribution_idx").on(
      t.projectId,
      t.attributionType,
    ),
    /** For cross-repo contributor visibility (§14.5): aggregating one human's
     *  work across all projects in an org. */
    ghUserIdIdx: index("contributors_gh_user_id_idx").on(t.ghUserId),
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
