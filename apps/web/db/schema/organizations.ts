import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createId } from "@repo/lib";
import type {
  ScoringConfig,
  PayoutConfig,
  AlignmentConfig,
  AgentRoutingPolicy,
  CommunityLinks,
} from "./projects";

/**
 * Per-org default config templates. Projects in an org snapshot the current
 * defaults at creation time; subsequent edits to org defaults do NOT propagate
 * to existing projects (predictable, no surprise mutations to live payouts).
 *
 * Defined in shipshape design doc §14.5. v1 keeps orgs as a namespace +
 * inheritance layer only — org-level tokens, org-level shipshape, org-wide
 * slash commands, and auto-sync of defaults are deferred to v2.
 */

export const organizations = pgTable(
  "organizations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    ghOrgId: text("gh_org_id").notNull(),
    ghLogin: text("gh_login").notNull(),
    displayName: text("display_name"),

    defaultScoringConfig: jsonb("default_scoring_config").$type<ScoringConfig>(),
    defaultAlignmentConfig:
      jsonb("default_alignment_config").$type<AlignmentConfig>(),
    defaultAgentRoutingPolicy:
      jsonb("default_agent_routing_policy").$type<AgentRoutingPolicy>(),
    defaultCommunityLinks:
      jsonb("default_community_links").$type<CommunityLinks>(),
    defaultPayoutConfig: jsonb("default_payout_config").$type<PayoutConfig>(),

    primaryWalletAddress: text("primary_wallet_address"),
    installedAt: timestamp("installed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    installedByUserId: text("installed_by_user_id").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ghOrgIdUq: uniqueIndex("organizations_gh_org_id_uq").on(t.ghOrgId),
    ghLoginUq: uniqueIndex("organizations_gh_login_uq").on(t.ghLogin),
    installedByIdx: index("organizations_installed_by_idx").on(
      t.installedByUserId,
    ),
  }),
);
